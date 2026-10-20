import type { Initialization } from '../domain/initialization.js';
import { ConfigSchema, defaultConfig, merge } from '../domain/config.js';
import type { PublicInitApi } from '../domain/public-init-api.js';
import type { ExCommand } from '../domain/ex-command.js';
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
 * Creates an isolated startup configuration session.
 *
 * The returned API is exposed to `init.mjs` while the script is evaluated.
 * Registration calls validate their runtime inputs, and option updates validate
 * the merged configuration. The session keeps its mutable state private.
 *
 * Call `finish()` after evaluating `init.mjs` to seal the session and obtain
 * the validated initialization. A successful call can happen only once; later
 * API calls and calls to `finish()` throw an error.
 *
 * @returns A fresh initialization runtime with a public registration API and
 *          a function for sealing the session.
 */
export function createInitRuntime(): InitRuntime {
  let config = defaultConfig;
  let initialAppId: string | undefined;
  const registeredApps = new Map<string, AppPackageReference>();
  const exCommands = new Map<string, ExCommand>();
  let finished = false;
  
  const checkFinished = (): void => {
    if (finished) {
      throw new Error('Initialization has finished. Make all initializations while init.mjs is evaluated.');
    }
  };
  
  const checkNonEmptyString = (value: unknown, label: string): void => {
    if (typeof value !== 'string') {
      throw new Error(`${label} must be a string.`);
    }

    if (value.trim().length === 0) {
      throw new Error(`${label} must not be empty.`);
    }
  };

  return {
    api: {
      options: {
        set: (patch) => {
          checkFinished();
          // Validate the complete result, not merely the patch. This preserves
          // domain invariants even when a patch changes nested configuration.
          config = ConfigSchema.parse(merge(config, patch));
        },
      },

      app: {
        register: (id, appReference) => {
          checkFinished();
          checkNonEmptyString(id, 'App ID');

          if (registeredApps.has(id)) {
            throw new Error(
              `An app with ID "${id}" was registered multiple times.`,
            );
          }
          
          registeredApps.set(id, AppPackageReference.parse(appReference));
        },

        initial: (appId) => {
          checkFinished();
          checkNonEmptyString(appId, 'App ID');

          initialAppId = appId;
        },
      },

      ex: {
        register: (name, execute) => {
          checkFinished();
          checkNonEmptyString(name, 'Ex command name');
          if (typeof execute !== 'function') {
            throw new Error('Ex command handler must be a function.');
          }
          
          if (exCommands.has(name)) {
            throw new Error(
              `An Ex command named "${name}" was registered multiple times.`,
            );
          }

          exCommands.set(name, { name, execute });
        },
      },
    },

    finish: () => {
      checkFinished();

      if (registeredApps.size === 0) {
        throw new Error(
          'Initialization did not register any apps. Call ' +
            'dirvi.apps.register(id, appReference) at least once in init.mjs.',
        );
      }
      
      let initial: string;

      if (initialAppId !== undefined) {
        if (!registeredApps.has(initialAppId)) {
          throw new Error(
            `Startup app "${initialAppId}" has not been registered.`,
          );
        }

        initial = initialAppId;
      } else {
        initial = getLastRegisteredAppId(registeredApps);
      }

      finished = true;
      
      return {
        config,
        app: {
          initial,
          registered: new Map(registeredApps),
        },
        exCommands: new Map(exCommands),
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
