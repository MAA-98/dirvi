import { useEffect, useMemo, useState } from 'react';

import type { AppMethodsApplicator } from 'dirvi-lib';

import type { AppScreenRenderer } from './app-screen-renderer.js';
import type { LoadingScreenRenderer } from './loading-screen-renderer.js';
import { AppSetup } from './AppSetup.js';
import type { Initialization } from '../domain/initialization.js';
import { createAppMethodsApplicator } from '../application/create-app-methods.js';
import type { ShellApi } from 'dirvi-apis';

export type InitialAppOptions = Readonly<{
  /**
   * Requested app ID at startup.
   *
   * The Shell will later use this to override or select the app chosen by
   * initialization.
   */
  readonly app?: string;

  /**
   * Host-provided startup input interpreted by the selected app.
   */
  readonly input?: string;
}>;

/**
 * Dependencies and output callbacks required by {@link Shell}.
 *
 * The API loader functions are injected so the shell does not depend directly
 * on a platform-specific infrastructure implementation.
 */
export type ShellAppProps = {
  /**
   * Host-specific React implementation.
   */
  readonly loadingScreenRenderer: LoadingScreenRenderer;
  readonly appScreenRenderer: AppScreenRenderer;

  readonly initialAppOptions: InitialAppOptions;
  readonly initialization: Initialization;

  /** Request to exit dirvi with an optional message. */
  readonly onQuit: (message?: string) => void;
  /** Stdout write handle. */
  readonly stdout?: (
    str: Uint8Array | string,
    encoding?: BufferEncoding,
    cb?: (err?: Error | null) => void,
  ) => boolean;
  /** Copies a value to the platform clipboard. */
  readonly clipboard?: (value: string) => void;
};

/**
 * Creates `ShellApi` and the `AppMethods` for a selected application.
 */
export function Shell({
  loadingScreenRenderer,
  appScreenRenderer,
  initialAppOptions,
  initialization,
  onQuit,
  stdout,
  clipboard,
}: ShellAppProps) {
  const [loadedApp, setLoadedApp] = useState<{
    appId: string;
    appMethodsApplicator: AppMethodsApplicator;
  }>();
  const [appError, setAppError] = useState<Error | undefined>(undefined);

  /**
   * Create the Shell API, based on given {@link Initialization}.
   */
  const shellApi = useMemo<ShellApi>(() => {
    return {
      listApps: () => [...initialization.app.registered.keys()],
      loadApp: async (appId, input) => {
        try {
          const asyncCreateAppDefinitionApplicator =
            initialization.app.registered.get(appId);

          if (asyncCreateAppDefinitionApplicator === undefined) {
            return {
              kind: 'notRegistered',
              appId,
              message: `App "${appId}" has not been registered in init.mjs.`,
            };
          }

          const appDefinitionApplicator =
            await asyncCreateAppDefinitionApplicator(input);

          if (typeof appDefinitionApplicator !== 'function') {
            throw new Error(
              'App create must return an app definition applicator.',
            );
          }

          const loadedAppMethodsApplicator = createAppMethodsApplicator(
            appDefinitionApplicator,
          );

          setLoadedApp({
            appId,
            appMethodsApplicator: loadedAppMethodsApplicator,
          });
          return { kind: 'loaded' };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          return {
            kind: 'loadFailed',
            appId,
            message: `Unable to load app "${appId}": ${message}`,
          };
        }
      },
      ...(clipboard === undefined ? {} : { clipboard }),
      ...(stdout === undefined ? {} : { stdout }),
      quit: onQuit,
    };
  }, [onQuit, initialization.app.registered, stdout, clipboard]);

  /**
   * Load initial `AppMethods` on startup, using the shell API just created and
   * {@link Initialization}.
   */
  useEffect(() => {
    void shellApi
      .loadApp(
        initialAppOptions.app ?? initialization.app.initial,
        initialAppOptions.input,
      )
      .then((result) => {
        if (result.kind !== 'loaded') {
          setAppError(new Error(result.message));
        }
      });
  }, [initialAppOptions, initialization.app.initial, shellApi]);

  if (appError !== undefined) {
    throw appError;
  }

  // TODO Later: Loading messages
  if (loadedApp === undefined) {
    const LoadingScreenRenderer = loadingScreenRenderer;
    return <LoadingScreenRenderer />;
  }

  return loadedApp.appMethodsApplicator((appMethods) => (
    <AppSetup
      appScreenRenderer={appScreenRenderer}
      loadingScreenRenderer={loadingScreenRenderer}
      appId={loadedApp.appId}
      initialization={initialization}
      shellApi={shellApi}
      appMethods={appMethods}
      {...(clipboard === undefined ? {} : { clipboard })}
    />
  ));
}
