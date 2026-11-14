import type {
  PublicInitApi,
  HighlightResolver,
  AsyncCreateAppDefinitionApplicator,
} from 'dirvi-apis';

import type { Initialization } from '../domain/initialization.js';
import { ConfigSchema, defaultConfig, merge } from '../domain/config.js';
import type { ExCommand, NormalCommand } from '../domain/command.js';
import {
  DuplicateAppRegistrationError,
  DuplicateExCommandRegistrationError,
  InitializationAlreadyFinishedError,
  InitRuntimeInvariantError,
  InvalidExCommandHandlerError,
  InvalidInitializationConfigError,
  InvalidInitializationValueError,
} from './init-runtime.error.js';

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
  const registeredApps = new Map<string, AsyncCreateAppDefinitionApplicator>();
  const normalCommands = new Map<string, Map<string, NormalCommand>>();
  const exCommands = new Map<string, Map<string, ExCommand>>();
  const highlightResolvers = new Map<string, HighlightResolver>();
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
      register: (app) => {
        ensureUnfinished();

        if (typeof app !== 'object' || app === null || Array.isArray(app)) {
          throw new InvalidInitializationValueError('App', 'must be an object');
        }

        const { id: appId, create, normal, ex, highlightResolver } = app;

        validateNonEmptyString(appId, 'App ID');

        if (registeredApps.has(appId)) {
          throw new DuplicateAppRegistrationError(appId);
        }

        if (typeof create !== 'function') {
          throw new InvalidInitializationValueError(
            'App create',
            'must be a function',
          );
        }

        // Normal commands registration
        if (normal !== undefined && !Array.isArray(normal)) {
          throw new InvalidInitializationValueError(
            'Normal commands',
            'must be an array',
          );
        }

        const appNormalCommands = new Map<string, NormalCommand>();

        for (const normalCommand of normal ?? []) {
          if (
            typeof normalCommand !== 'object' ||
            normalCommand === null ||
            Array.isArray(normalCommand)
          ) {
            throw new InvalidInitializationValueError(
              'Normal command',
              'must be an object',
            );
          }

          const { command, execute } = normalCommand;

          if (typeof command !== 'string' || command.length === 0) {
            throw new InvalidInitializationValueError(
              'Normal command sequence',
              'must be a nonempty string',
            );
          }

          if (command.startsWith(':')) {
            throw new InvalidInitializationValueError(
              'Normal command sequence',
              'must not start with the reserved ":" key',
            );
          }

          if (typeof execute !== 'function') {
            throw new InvalidInitializationValueError(
              'Normal command handler',
              'must be a function',
            );
          }

          if (appNormalCommands.has(command)) {
            throw new InvalidInitializationValueError(
              'Normal command sequence',
              `is already registered: "${command}"`,
            );
          }

          appNormalCommands.set(command, { execute });
        }

        // Ex command registration
        if (ex !== undefined && !Array.isArray(ex)) {
          throw new InvalidInitializationValueError(
            'Ex commands',
            'must be an array',
          );
        }

        const appExCommands = new Map<string, ExCommand>();

        for (const exCommand of ex ?? []) {
          if (
            typeof exCommand !== 'object' ||
            exCommand === null ||
            Array.isArray(exCommand)
          ) {
            throw new InvalidInitializationValueError(
              'Ex command',
              'must be an object',
            );
          }

          const { command, execute } = exCommand;
          validateNonEmptyString(command, 'Ex command name');

          if (typeof execute !== 'function') {
            throw new InvalidExCommandHandlerError();
          }

          if (appExCommands.has(command)) {
            throw new DuplicateExCommandRegistrationError(command);
          }

          appExCommands.set(command, { execute });
        }

        if (
          highlightResolver !== undefined &&
          typeof highlightResolver !== 'function'
        ) {
          throw new InvalidInitializationValueError(
            'Highlight resolver',
            'must be a function',
          );
        }

        registeredApps.set(appId, create);
        normalCommands.set(appId, appNormalCommands);
        exCommands.set(appId, appExCommands);
        if (highlightResolver !== undefined) {
          highlightResolvers.set(appId, highlightResolver);
        }
      },

      initial: (appId) => {
        ensureUnfinished();
        validateNonEmptyString(appId, 'App ID');

        initialAppId = appId;
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
          'dirvi.app.register({ id, create }) at least once in init.mjs.',
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
      normalCommands: new Map(
        [...normalCommands].map(([appId, commands]) => [
          appId,
          new Map(commands),
        ]),
      ),
      exCommands: new Map(
        [...exCommands].map(([appId, commands]) => [appId, new Map(commands)]),
      ),
      highlightResolvers: new Map(highlightResolvers),
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
  apps: ReadonlyMap<string, AsyncCreateAppDefinitionApplicator>,
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
