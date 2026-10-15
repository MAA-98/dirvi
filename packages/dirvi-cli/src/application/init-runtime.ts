import { App } from 'dirvi-apis';

import type { Config, ConfigPatch } from '../domain/config.js';
import { ConfigSchema, defaultConfig, merge } from '../domain/config.js';
import type { AppPackageReference } from './app-pack-ref.js';
import type { AppPackageInstaller } from './app-pack-installer.js';

/**
 * The startup configuration API exposed to init.mjs as the global `dirvi`.
 *
 * This is intentionally a narrow facade. It is the public scripting boundary,
 * rather than an escape hatch into UI state or infrastructure implementations.
 */
export type InitApi = {
  readonly options: {
    set: (patch: ConfigPatch) => void;
  };

  readonly apps: {
    install: (reference: AppPackageReference) => Promise<App>;
    /**
     * Registers an application made available by init.mjs.
     */
    use: (appPlugin: App) => void;
    /**
     * Selects the app that should initially be opened by the shell.
     */
    startupApp: (appId: string) => void;
  };
};

/**
 * Everything registered while init.mjs was evaluated.
 *
 * Config is shared tree-UI configuration. App selection is distinct from Config
 * value.
 */
export type Init = {
  readonly config: Config;
  readonly apps: readonly App[];
  readonly initialAppId: string;
};

/**
 * Collects startup configuration registrations while init.mjs is evaluated.
 *
 * The application exposes `api` to the script, then calls `finish()` once
 * evaluation completes to seal registration and obtain the validated Config.
 */
export type InitRuntime = {
  readonly api: InitApi;
  readonly finish: () => Init;
};

/**
 * Creates a fresh startup configuration session.
 *
 * Each runtime owns its own mutable configuration while registration is open.
 * The mutable state is not exposed directly to the config script.
 */
export function createInitRuntime(
  appPackageInstaller: Readonly<AppPackageInstaller>
): InitRuntime {
  let config = defaultConfig;
  let initialAppId: string | undefined;
  const appPlugins = new Map<string, App>();
  const pendingAppInstallations = new Set<Promise<App>>();
  let finished = false;

  return {
    api: {
      options: {
        set: (patch) => {
          // init.mjs is a startup script. It must not modify startup options
          // after the host has finished evaluating and consuming it.
          if (finished) {
            throw new Error(
              'Initialization has finished. Configure dirvi while init.mjs is being evaluated.',
            );
          }

          // Validate the complete result, not merely the patch. This preserves
          // domain invariants even when a patch changes nested configuration.
          config = ConfigSchema.parse(merge(config, patch));
        },
      },

      apps: {
        install: (ref) => {
          if (finished) {
            throw new Error(
              'Initialization has finished. Install apps while init.mjs is being evaluated.',
            );
          }

          const installation = appPackageInstaller.install(ref);

          pendingAppInstallations.add(installation);

          return installation.finally(() => {
            pendingAppInstallations.delete(installation);
          });
        },

        use: (appPlugin) => {
          if (finished) {
            throw new Error(
              'Initialization has finished. Register apps while init.mjs is being evaluated.',
            );
          }

          if (appPlugin.id.trim().length === 0) {
            throw new Error('App plugin ID must not be empty.');
          }

          if (appPlugins.has(appPlugin.id)) {
            throw new Error(
              `An app plugin with ID "${appPlugin.id}" is already registered.`,
            );
          }

          appPlugins.set(appPlugin.id, appPlugin);
        },

        startupApp: (appId) => {
          if (finished) {
            throw new Error(
              'Initialization has finished. Select an initial app while init.mjs is being evaluated.',
            );
          }

          if (appId.trim().length === 0) {
            throw new Error('App ID must not be empty.');
          }

          initialAppId = appId;
        },
      },
    },

    finish: () => {
      if (pendingAppInstallations.size > 0) {
        throw new Error(
          'Initialization contains unfinished app installations. Await dirvi.apps.install(...).',
        );
      }
      finished = true;
      if (initialAppId === undefined) {
        throw new Error(
          'Initialization did not select a startup app. Call dirvi.apps.startupApp(appId) in init.mjs.',
        );
      }
      if (!appPlugins.has(initialAppId)) {
        throw new Error(
          `Startup app "${initialAppId}" has not been registered. Call dirvi.apps.use(appPlugin) first.`,
        );
      }
      return {
        config,
        apps: [...appPlugins.values()],
        initialAppId,
      };
    },
  };
}
