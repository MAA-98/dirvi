import type { Initialization } from '../domain/initialization.js';
import { ConfigSchema, defaultConfig, merge } from '../domain/config.js';
import type { PublicInitApi } from '../domain/public-init-api.js';
import { ExCommand } from '../domain/ex-command.js';
import { AppPackageReference } from '../domain/app-pack-ref.js';

/**
 * Collects startup configuration registrations while init.mjs is evaluated.
 *
 * The application exposes `api` to the script, then calls `finish()` once
 * evaluation completes to seal registration and obtain the validated Config.
 */
export type InitRuntime = {
  readonly api: PublicInitApi;
  readonly finish: () => Initialization;
};

/**
 * Creates a fresh startup configuration session.
 *
 * Each runtime owns its own mutable configuration while registration is open.
 * The mutable state is not exposed directly to the config script.
 */
export function createInitRuntime(): InitRuntime {
  let config = defaultConfig;
  let initialAppId: string | undefined;
  const apps = new Map<string, AppPackageReference>();
  const exCommands = new Map<string, ExCommand>();
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
        register: (id, appReference) => {
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

          apps.set(id, appReference);
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

      ex: {
        register: (name, execute) => {
          if (finished) {
            throw new Error(
              'Initialization has finished. Register Ex commands while ' +
                'init.mjs is being evaluated.',
            );
          }

          if (name.trim().length === 0) {
            throw new Error('Ex command name must not be empty.');
          }

          if (exCommands.has(name)) {
            throw new Error(
              `An Ex command named "${name}" was registered multiple times.`,
            );
          }

          exCommands.set(name, {
            name,
            execute,
          });
        },
      },
    },

    finish: () => {
      if (finished) {
        throw new Error('Initialization has already finished.');
      }

      if (apps.size === 0) {
        throw new Error(
          'Initialization did not register any apps. Call ' +
            'dirvi.apps.register(id, appReference) at least once in init.mjs.',
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
          initialAppId: initialAppId,
          registeredApps: new Map(apps),
          exCommands: [...exCommands.values()],
        };
      }

      const lastRegisteredAppRef = getLastRegisteredAppId(apps);

      finished = true;

      return {
        config,
        initialAppId: lastRegisteredAppRef,
        registeredApps: new Map(apps),
        exCommands: [...exCommands.values()],
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
function getLastRegisteredAppId(
  apps: ReadonlyMap<string, AppPackageReference>,
): string {
  const appIds = [...apps.keys()];
  const lastAppId = appIds.at(-1);

  if (lastAppId === undefined) {
    throw new Error(
      'Internal error: Check some app is registered before searching ids.',
    );
  }

  return lastAppId;
}
