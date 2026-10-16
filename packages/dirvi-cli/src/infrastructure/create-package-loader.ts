import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import type { AppPlugin } from 'dirvi-apis';
import type { PackageLoader } from '@mak-98/dirvi-app';
import { AppPackageReference } from '@mak-98/dirvi-app';

const execFileAsync = promisify(execFile);

/**
 * Produces a filesystem-safe directory name for one exact npm app reference.
 *
 * The version is included deliberately: different versions of one npm package
 * are distinct installed artifacts and may be loaded together.
 */
function getNpmAppPackageDirectoryName(reference: AppPackageReference): string {
  return `${reference.packageName.replace(/^@/, '').replace('/', '__')}@${reference.version}`;
}

/**
 * Returns the installation directory for one app package reference.
 *
 * Layout:
 *
 *   <dirvi data>/site/pack/apps/opt/npm/<package-name>@<exact-version>
 */
function getAppPackageDirectory(
  packagesDirectory: string,
  reference: AppPackageReference,
): string {
  switch (reference.source) {
    case 'npm':
      return join(
        packagesDirectory,
        'apps',
        'opt',
        'npm',
        getNpmAppPackageDirectoryName(reference),
      );
  }
}

/**
 * Installs Node-based Dirvi app packages into Dirvi's dedicated package store.
 *
 * Every app gets a small npm project of its own. That lets Node resolve the
 * plugin package and all of its transitive dependencies without adding apps
 * to dirvi-cli's own dependency graph.
 *
 * @param packagesDirectory - The directory corresponding to:
 * <dirvi data>/site/pack/dirvi/opt
 */
export function createPackageLoader(packagesDirectory: string): PackageLoader {
  const loadingPluginsByPath = new Map<string, Promise<AppPlugin>>();

  return {
    loadAppPlugin: (referenceInput) => {
      const reference = AppPackageReference.parse(referenceInput);

      const appPackageDirectory = getAppPackageDirectory(
        packagesDirectory,
        reference,
      );

      const alreadyLoading = loadingPluginsByPath.get(appPackageDirectory);
      if (alreadyLoading !== undefined) {
        return alreadyLoading;
      }

      const installation = loadAppPluginFromDirectory(
        packagesDirectory,
        reference,
      );

      loadingPluginsByPath.set(appPackageDirectory, installation);

      return installation.finally(() => {
        if (loadingPluginsByPath.get(appPackageDirectory) === installation) {
          loadingPluginsByPath.delete(appPackageDirectory);
        }
      });
    },
  };
}

async function loadAppPluginFromDirectory(
  appPackageDirectory: string,
  reference: AppPackageReference,
): Promise<AppPlugin> {
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
): Promise<AppPlugin> {
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
): AppPlugin {
  if (!isRecord(value) || typeof value.createAppApiApplicator !== 'function') {
    throw new Error(
      `Dirvi app package "${reference.packageName}" must default-export an ` +
        'AppPlugin with createAppApiApplicator(input).',
    );
  }

  return value as AppPlugin;
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
