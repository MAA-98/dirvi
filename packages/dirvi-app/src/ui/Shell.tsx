import { useEffect, useMemo, useState } from 'react';

import type { AppApiApplicator } from 'dirvi-apis';

import type { AppScreenRenderer } from './app-screen-renderer.js';
import type { LoadingScreenRenderer } from './loading-screen-renderer.js';
import { AppSetup } from './AppSetup.js';
import type { Initialization } from '../domain/initialization.js';
import type { PackageLoader } from '../application/package-loader.js';
import { ShellApi } from '../domain/shell-api.js';
import { createAppApiApplicator } from '../application/create-app-api.js';

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

  /** Writes non-interactive application output. */
  readonly stdout?: (message: string) => void;

  /** Copies a value to the platform clipboard. */
  readonly clipboard?: (value: string) => void;
};

/**
 * Hosts the currently active application inside the persistent terminal shell.
 *
 * Shell deliberately does not depend on a concrete AppApi type. OpenApp keeps
 * each application's Id, Value, and ViewKey types coherent while hiding those
 * details from shell-level concerns such as startup, app selection, terminal
 * integration, clipboard access, and error reporting.
 *
 * AppSetup receives the concrete AppApi and mounts the app-specific tree UI.
 */
export function Shell({
  loadingScreenRenderer,
  appScreenRenderer,
  initialAppOptions,
  initialization,
  packageLoader,
  stdout,
  clipboard,
}: ShellAppProps) {
  const [appApiApplicator, setAppApiApplicator] = useState<
    AppApiApplicator | undefined
  >(undefined);
  const [appError, setAppError] = useState<Error | undefined>(undefined);

  const shellApi = useMemo<ShellApi>(() => {
    return {
      openApp: async (appId, input) => {
        const appReference = initialization.app.registered.get(appId);

        if (appReference === undefined) {
          throw new Error(`App "${appId}" has not been registered.`);
        }

        setAppApiApplicator(undefined);
        setAppError(undefined);

        const appPlugin = await packageLoader.loadAppPlugin(appReference);
        const loadedAppApiApplicator = createAppApiApplicator(
          appPlugin.createAppDefinitionApplicator(input),
        );

        setAppApiApplicator(() => loadedAppApiApplicator);
      },
    };
  }, [packageLoader, initialization.app.registered]);

  useEffect(() => {
    void shellApi
      .openApp(
        initialAppOptions.app ?? initialization.app.initial,
        initialAppOptions.input,
      )
      .catch((error: unknown) => {
        setAppError(error instanceof Error ? error : new Error(String(error)));
      });
  }, [initialAppOptions.input, initialization.app.initial, shellApi]);

  if (appError !== undefined) {
    throw appError;
  }
  const initialAppReference = initialization.app.registered.get(
    initialization.app.initial,
  );
  if (initialAppReference === undefined) {
    throw new Error(
      `Startup app "${initialization.app.initial}" has not been registered.`,
    );
  }

  if (appApiApplicator === undefined) {
    const LoadingScreenRenderer = loadingScreenRenderer;
    return <LoadingScreenRenderer />;
  }

  // Result type is specified here to be AppSetup
  return appApiApplicator((appApi) => (
    <AppSetup
      appScreenRenderer={appScreenRenderer}
      loadingScreenRenderer={loadingScreenRenderer}
      initialization={initialization}
      shellApi={shellApi}
      appApi={appApi}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
    />
  ));
}
