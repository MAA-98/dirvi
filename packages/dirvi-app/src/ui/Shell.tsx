import { useEffect, useMemo, useState } from 'react';

import type { AppMethodsApplicator } from 'dirvi-lib';

import type { AppScreenRenderer } from './app-screen-renderer.js';
import type { LoadingScreenRenderer } from './loading-screen-renderer.js';
import { AppSetup } from './AppSetup.js';
import type { Initialization } from '../domain/initialization.js';
import type { PackageLoader } from '../application/package-loader.js';
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
  readonly packageLoader: PackageLoader;

  /** Request to exit dirvi with an optional message. */
  readonly onQuit: (message?: string) => void;
  /** Writes non-interactive application output. */
  readonly stdout?: (message: string) => void;
  /** Copies a value to the platform clipboard. */
  readonly clipboard?: (value: string) => void;
};

/**
 * Creates `ShellApi` and the `AppMethods` for a selected application.
 */
export function Shell({
  onQuit,
  loadingScreenRenderer,
  appScreenRenderer,
  initialAppOptions,
  initialization,
  packageLoader,
  stdout,
  clipboard,
}: ShellAppProps) {
  const [appMethodsApplicator, setAppMethodsApplicator] = useState<
    AppMethodsApplicator | undefined
  >(undefined);
  const [appError, setAppError] = useState<Error | undefined>(undefined);

  /**
   * Create the Shell API, based on given {@link Initialization}.
   */
  const shellApi = useMemo<ShellApi>(() => {
    return {
      loadApp: async (appId, input) => {
        try {
          const appReference = initialization.app.registered.get(appId);

          if (appReference === undefined) {
            return {
              kind: 'notRegistered',
              appId,
              message: `App "${appId}" has not been registered in initial configuration script.`,
            };
          }
          
          const appPlugin = await packageLoader.loadAppPlugin(appReference);
          const loadedAppMethodsApplicator = createAppMethodsApplicator(
            appPlugin.createAppDefinitionApplicator(input),
          );
          
          setAppMethodsApplicator(() => loadedAppMethodsApplicator);
          return { kind: 'loaded' }
        } catch(error) {
          const message =
            error instanceof Error ? error.message : String(error);

          return {
            kind: 'loadFailed',
            appId,
            message: `Unable to load app "${appId}": ${message}`,
          };
        }
      },
      quit: onQuit,
    };
  }, [packageLoader, onQuit, initialization.app.registered]);

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
      })
  }, [
    initialAppOptions,
    initialization.app.initial,
    shellApi,
  ]);

  if (appError !== undefined) {
    throw appError;
  }

  // TODO Later: Loading messages
  if (appMethodsApplicator === undefined) {
    const LoadingScreenRenderer = loadingScreenRenderer;
    return <LoadingScreenRenderer />;
  }

  return appMethodsApplicator((appMethods) => (
    <AppSetup
      appScreenRenderer={appScreenRenderer}
      loadingScreenRenderer={loadingScreenRenderer}
      initialization={initialization}
      shellApi={shellApi}
      appMethods={appMethods}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
    />
  ));
}
