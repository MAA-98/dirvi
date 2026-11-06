import type { Initialization } from '../domain/initialization.js';
import { ConfigSchema, defaultConfig, merge } from '../domain/config.js';
import type { PublicInitApi } from 'dirvi-apis';
import type { ExCommand } from '../domain/ex-command.js';
import { AppPackageReference } from 'dirvi-apis';
import {
  DuplicateAppRegistrationError, DuplicateExCommandRegistrationError,
  InitializationAlreadyFinishedError,
  InitRuntimeInvariantError, InvalidAppPackageReferenceError, InvalidExCommandHandlerError,
  InvalidInitializationConfigError,
  InvalidInitializationValueError,
} from './init-runtime.error.js';
import { AppPackageReferenceMethods } from './app-pack-ref.js';

/**
 * A session for collecting and resolving initialization-script registrations.
 *
 * Expose `api` while evaluating `init.mjs`, then call `finish()` after module
 * evaluation completes. Finishing validates the collected state and returns an
 * immutable-by-contract snapshot of the resolved initialization.
 */
export type InitRuntime = {
  /** The temporary API made available to `init.mjs` during evaluation. */
  readonly api: PublicInitApi;

  /**
   * Validates and seals this session, returning its resolved startup state.
   *
   * The session is sealed only after successful validation. Once sealed,
   * further API calls and calls to `finish()` throw
   * `InitializationAlreadyFinishedError`.
   */
  readonly finish: () => Initialization;
};

/**
 * Creates an isolated session for evaluating one `init.mjs` script.
 *
 * Option patches are merged with the current config and the complete result is
 * validated. App and command registrations are checked as they are made.
 *
 * The runtime keeps its working state inside the closure and exposes it only
 * through `api` and `finish`. finish() returns new maps, so later changes to
 * the runtime’s maps cannot alter the returned maps.
 *
 * If no startup app is selected explicitly, the most recently registered app
 * is chosen. At least one app must be registered before the session can finish.
 *
 * @returns A fresh initialization API and its corresponding `finish` function.
 * @throws {InitRuntimeError} If a registration is invalid, validation fails,
 *   no app was registered, or the session has already been finished.
 */
export function createInitRuntime(): InitRuntime {
  let config = defaultConfig;
  let initialAppId: string | undefined;
  const registeredApps = new Map<string, AppPackageReference>();
  const exCommands = new Map<string, ExCommand>();
  let finished = false;

  // === Error Helpers =========================================================
  /**
   * Rejects API use after a successful call to `finish()`.
   *
   * Failed calls to `finish()` do not seal the runtime, allowing the caller to
   * correct registrations and try again.
   */
  const ensureUnfinished = (): void => {
    if (finished) {
      throw new InitializationAlreadyFinishedError();
    }
  };

  /** Validates values. */
  const validateNonEmptyString = (value: unknown, label: string): void => {
    if (typeof value !== 'string') {
      throw new InvalidInitializationValueError(label, 'must be a string');
    }

    if (value.trim().length === 0) {
      throw new InvalidInitializationValueError(label, 'must not be empty');
    }
  };

  // === Public Initialization API =============================================
  const api: PublicInitApi = {
    options: {
      set: (patch) => {
        ensureUnfinished();
        try {
          // Validate the merged result so patches cannot break config
          // invariants outside the fields they directly update.
          config = ConfigSchema.parse(merge(config, patch));
        } catch (cause) {
          throw new InvalidInitializationConfigError(cause);
        }
      },
    },

    app: {
      register: (id, appReference) => {
        ensureUnfinished();
        validateNonEmptyString(id, 'App ID');

        if (registeredApps.has(id)) {
          throw new DuplicateAppRegistrationError(id);
        }

        try {
          registeredApps.set(id, AppPackageReferenceMethods.parse(appReference));
        } catch (cause) {
          throw new InvalidAppPackageReferenceError(cause);
        }
      },

      initial: (appId) => {
        ensureUnfinished();
        validateNonEmptyString(appId, 'App ID');

        initialAppId = appId;
      },
    },

    ex: {
      register: (name, execute) => {
        ensureUnfinished();
        validateNonEmptyString(name, 'Ex command name');
        if (typeof execute !== 'function') {
          throw new InvalidExCommandHandlerError();
        }

        if (exCommands.has(name)) {
          throw new DuplicateExCommandRegistrationError(name);
        }

        exCommands.set(name, { name, execute });
      },
    },
  };

  /**
   * === FINISH ================================================================
   * Resolves the startup app, seals the session, and returns its snapshot.
   *
   * Validation happens before sealing, so a failed finish can be retried after
   * the script corrects its registrations.
   * ===========================================================================
   */
  const finish: () => Initialization = () => {
    ensureUnfinished();

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
  };

  return {
    api,
    finish,
  };
}

/**
 * Returns the app registered last, using `Map` insertion order.
 *
 * This is only the fallback when `init.mjs` does not explicitly select an
 * initial app. Callers must check that the map is non-empty first.
 *
 * @throws {InitRuntimeInvariantError} If called with an empty map.
 */
function getLastRegisteredAppId(
  apps: ReadonlyMap<string, AppPackageReference>,
): string {
  const appIds = [...apps.keys()];
  const lastAppId = appIds.at(-1);
  
  if (lastAppId === undefined) {
    throw new InitRuntimeInvariantError(
      'Expected at least one registered app when selecting the startup app.',
    );
  }

  return lastAppId;
}
