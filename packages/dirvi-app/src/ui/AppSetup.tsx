import { useEffect, useMemo, useState } from 'react';

import type { AppApi, SerializableKey, State } from 'dirvi-lib';
import {
  createEffectToAction,
  createIntentToEffect,
  createReducer,
} from 'dirvi-lib';

import type { LoadingScreenRenderer } from './loading-screen-renderer.js';
import type { AppScreenRenderer } from './app-screen-renderer.js';
import type { Config } from '../domain/config.js';
import { App } from './App.js';
import { ShellApi } from '../domain/shell-api.js';
import { Initialization } from '../domain/initialization.js';

// TODO Later: configuration watched for changes

type LoadingAppProps<Id extends SerializableKey, Value, ViewKey = string> = {
  appScreenRenderer: AppScreenRenderer;
  loadingScreenRenderer: LoadingScreenRenderer;
  initialization: Initialization;
  shellApi: ShellApi;
  appApi: AppApi<Id, Value, ViewKey>;
  stdout?: (message: string) => void;
  clipboard?: (value: string) => void;
};

export function AppSetup<Id extends SerializableKey, Value, ViewKey = string>({
  appScreenRenderer,
  loadingScreenRenderer,
  initialization,
  shellApi,
  appApi,
  stdout,
  clipboard,
}: LoadingAppProps<Id, Value, ViewKey>) {
  const [initialState, setInitialState] = useState<State<Id, Value>>();

  // Loading and setting initial state.
  useEffect(() => {
    let mounted = true;

    appApi
      .createRoot()
      .then((root) => {
        if (!mounted) {
          return;
        }
        
        setInitialState(
          appApi.stateApi.create(
            root,
            appApi.stateApi.foldsApi.create(appApi.rootId, {
              name: 'default',
              description: null,
            }),
            { path: [] }
          )
        )
      })
      .catch((cause: unknown) => {
        const nextError =
          cause instanceof Error ? cause : new Error(String(cause));

        if (!mounted) {
          return;
        }

        throw nextError;
      });

    return () => {
      mounted = false;
    };
  }, [appApi]);

  // --- Pure function deps ---

  const reducer = useMemo(
    () => createReducer(appApi.stateApi, appApi.navMethods),
    [appApi.stateApi, appApi.navMethods],
  );

  const intentToEffect = useMemo(
    () =>
      createIntentToEffect(
        new Set(initialization.exCommands.keys()),
        appApi.stateApi,
      ),
    [appApi.stateApi, initialization.exCommands],
  );

  const effectToAction = useMemo(
    () =>
      createEffectToAction(
        appApi.stateApi,
        appApi.navMethods,
      ),
    [appApi.navMethods, appApi.stateApi],
  );

  // --- JSX ---
  const LoadingScreenRenderer = loadingScreenRenderer;
  if (initialState === undefined) {
    return <LoadingScreenRenderer />;
  }

  return (
    <App
      screenRenderer={appScreenRenderer}
      shellApi={shellApi}
      appApi={appApi}
      initialization={initialization}
      initialState={initialState}
      reducer={reducer}
      intentToEffect={intentToEffect}
      effectToAction={effectToAction}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
    />
  );
}
