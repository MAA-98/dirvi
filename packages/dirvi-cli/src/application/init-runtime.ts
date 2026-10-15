import type { AppPlugin } from 'dirvi-apis';

import { createApp, type App } from './app.js';
import type { Config, ConfigPatch } from '../domain/config.js';
import { ConfigSchema, defaultConfig, merge } from '../domain/config.js';
import type { AppPackageReference } from './app-pack-ref.js';
import type { PackageLoader } from '../domain/package-loader.js';

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
    install: (reference: AppPackageReference) => Promise<AppPlugin>;
    /**
     * Registers an application made available by init.mjs.
     */
    register: (id: string, appPlugin: AppPlugin) => void;
    /**
     * Optionally selects the app initially opened by the shell.
     *
     * If omitted, the runtime falls back to the most recently registered app.
     */
    initialAppId: (appId: string) => void;
  };
};

/**
 * Everything registered while init.mjs was evaluated.
 *
 * Config is shared tree-UI configuration. App selection is distinct from Config
 * value. initialAppId is always the ID of one app in apps: either the app
 * explicitly selected by init.mjs or the most recently registered app.
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
  appPackageLoader: Readonly<PackageLoader>,
): InitRuntime {
  let config = defaultConfig;
  let initialAppId: string | undefined;
  const apps = new Map<string, App>();
  const pendingAppPlugins = new Set<Promise<AppPlugin>>();
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

          const promisedAppPlugins = appPackageLoader.loadAppPlugin(ref);
          pendingAppPlugins.add(promisedAppPlugins);

          return promisedAppPlugins.finally(() => {
            pendingAppPlugins.delete(promisedAppPlugins);
          });
        },

        register: (id, appPlugin) => {
          if (finished) {
            throw new Error(
              'Initialization has finished. Register apps while ' +
                'init.mjs is being evaluated.',
            );
          }

          if (id.trim().length === 0) {
            throw new Error('App ID must not be empty.');
          }

          if (apps.has(id)) {
            throw new Error(
              `An app with ID "${id}" was registered multiple times.`,
            );
          }

          apps.set(id, createApp(id, appPlugin));
        },

        initialAppId: (appId) => {
          if (finished) {
            throw new Error(
              'Initialization has finished. Select an initial app while ' +
                'init.mjs is being evaluated.',
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
      if (finished) {
        throw new Error('Initialization has already finished.');
      }

      if (pendingAppPlugins.size > 0) {
        throw new Error(
          'Initialization contains unfinished app installations. Await ' +
            'dirvi.apps.install(...).',
        );
      }

      if (apps.size === 0) {
        throw new Error(
          'Initialization did not register any apps. Call ' +
            'dirvi.apps.register(id, appPlugin) at least once in init.mjs.',
        );
      }

      if (initialAppId !== undefined) {
        if (!apps.has(initialAppId)) {
          throw new Error(
            `Startup app "${initialAppId}" has not been registered.`,
          );
        }
        finished = true;
        return {
          config,
          apps: [...apps.values()],
          initialAppId: initialAppId,
        };
      }

      const lastRegisteredAppId = getLastRegisteredAppId(apps);

      finished = true;

      return {
        config,
        apps: [...apps.values()],
        initialAppId: lastRegisteredAppId,
      };
    },
  };
}

/**
 * Returns the most recently registered app ID.
 *
 * Map iteration follows registration insertion order. This is a convenience
 * fallback only; init.mjs should set initialAppId explicitly when startup
 * selection is semantically important.
 */
function getLastRegisteredAppId(apps: ReadonlyMap<string, App>): string {
  const appIds = [...apps.keys()];
  const lastAppId = appIds.at(-1);

  if (lastAppId === undefined) {
    throw new Error(
      'Internal error: Check some app is registered before searching ' + 'ids.',
    );
  }

  return lastAppId;
}
