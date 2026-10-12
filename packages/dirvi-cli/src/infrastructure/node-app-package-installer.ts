import { App } from 'dirvi-apis';

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import type { AppPackageInstaller } from '../application/app-pack-installer.js';
import type { AppPackageReference } from '../application/app-pack-ref.js';

const execFileAsync = promisify(execFile);

export type NodeAppPackageInstallerOptions = {
  /**
   * The directory corresponding to:
   *
   *   <dirvi data>/site/pack/dirvi/opt
   */
  readonly appPackagesDirectory: string;
};

/**
 * Installs Node-based Dirvi app packages into Dirvi's dedicated package store.
 *
 * Every app gets a small npm project of its own. That lets Node resolve the
 * plugin package and all of its transitive dependencies without adding apps
 * to dirvi-cli's own dependency graph.
 */
export function createNodeAppPackageInstaller(
  options: NodeAppPackageInstallerOptions,
): AppPackageInstaller {
  const installations = new Map<string, Promise<App>>();

  return {
    install: (reference) => {
      assertAppPackageReference(reference);

      const existingInstallation = installations.get(reference.packageName);

      if (existingInstallation !== undefined) {
        return existingInstallation;
      }

      const installation = installAppPackage(options, reference);

      installations.set(reference.packageName, installation);

      return installation.finally(() => {
        if (installations.get(reference.packageName) === installation) {
          installations.delete(reference.packageName);
        }
      });
    },
  };
}

async function installAppPackage(
  options: NodeAppPackageInstallerOptions,
  reference: AppPackageReference,
): Promise<App> {
  const appPackageDirectory = join(
    options.appPackagesDirectory,
    getAppPackageDirectoryName(reference.packageName),
  );

  await ensureAppPackageDirectory(appPackageDirectory);

  if (!(await hasInstalledVersion(appPackageDirectory, reference))) {
    await installWithNpm(appPackageDirectory, reference);
  }

  return loadInstalledAppPlugin(appPackageDirectory, reference);
}

/**
 * Creates the local npm-project manifest for one managed app package.
 *
 * npm owns its dependencies and lock file after this point.
 */
async function ensureAppPackageDirectory(
  appPackageDirectory: string,
): Promise<void> {
  await mkdir(appPackageDirectory, { recursive: true });

  const packageJsonPath = join(appPackageDirectory, 'package.json');

  try {
    await readFile(packageJsonPath, 'utf8');
  } catch (error) {
    if (!isNodeError(error, 'ENOENT')) {
      throw error;
    }

    await writeFile(
      packageJsonPath,
      `${JSON.stringify(
        {
          private: true,
          type: 'module',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }
}

async function hasInstalledVersion(
  appPackageDirectory: string,
  reference: AppPackageReference,
): Promise<boolean> {
  const installedPackageJsonPath = join(
    appPackageDirectory,
    'node_modules',
    reference.packageName,
    'package.json',
  );

  try {
    const installedPackageJson = JSON.parse(
      await readFile(installedPackageJsonPath, 'utf8'),
    ) as { version?: unknown };

    return installedPackageJson.version === reference.version;
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) {
      return false;
    }

    throw error;
  }
}

async function installWithNpm(
  appPackageDirectory: string,
  reference: AppPackageReference,
): Promise<void> {
  const packageSpec = `${reference.packageName}@${reference.version}`;

  try {
    await execFileAsync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      [
        'install',
        '--prefix',
        appPackageDirectory,
        '--save-exact',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        packageSpec,
      ],
      {
        maxBuffer: 1024 * 1024,
      },
    );
  } catch (error) {
    throw new Error(`Could not install Dirvi app package "${packageSpec}".`, {
      cause: error,
    });
  }
}

async function loadInstalledAppPlugin(
  appPackageDirectory: string,
  reference: AppPackageReference,
): Promise<App> {
  const requireFromAppPackageDirectory = createRequire(
    join(appPackageDirectory, 'package.json'),
  );

  let packageEntryPath: string;

  try {
    packageEntryPath = requireFromAppPackageDirectory.resolve(
      reference.packageName,
    );
  } catch (error) {
    throw new Error(
      `Could not resolve installed Dirvi app package "${reference.packageName}".`,
      { cause: error },
    );
  }

  const loadedModule = await import(pathToFileURL(packageEntryPath).href);

  return parseAppPlugin(loadedModule.default, reference);
}

function parseAppPlugin(
  value: unknown,
  reference: AppPackageReference,
): App {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.trim().length === 0 ||
    typeof value.open !== 'function'
  ) {
    throw new Error(
      `Dirvi app package "${reference.packageName}" must default-export an AppPlugin.`,
    );
  }

  return value as App;
}

function assertAppPackageReference(reference: AppPackageReference): void {
  if (
    !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(
      reference.packageName,
    )
  ) {
    throw new Error(
      `Invalid npm package name "${reference.packageName}" for a Dirvi app.`,
    );
  }

  if (
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
      reference.version,
    )
  ) {
    throw new Error(
      `Dirvi app package "${reference.packageName}" must use an exact version.`,
    );
  }
}

function getAppPackageDirectoryName(packageName: string): string {
  return packageName.replace(/^@/, '').replace('/', '__');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNodeError(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return isRecord(error) && error.code === code;
}
