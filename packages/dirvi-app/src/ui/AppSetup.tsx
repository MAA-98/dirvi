import { useEffect, useMemo, useState } from 'react';

import { AppApi, createTreeMethods, SerializableKey, State } from 'dirvi-lib';
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

type LoadState<Id extends SerializableKey, Value, ViewKey> =
  | {
      status: 'loading';
      appApi: AppApi<Id, Value, ViewKey>;
    }
  | {
      status: 'ready';
      appApi: AppApi<Id, Value, ViewKey>;
      initialState: State<Id, Value>;
    }
  | {
      status: 'error';
      appApi: AppApi<Id, Value, ViewKey>;
      error: Error;
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
  const [loadState, setLoadState] = useState<LoadState<Id, Value, ViewKey>>();

  // Loading and setting initial state.
  useEffect(() => {
    let mounted = true;

    setLoadState({ status: 'loading', appApi });

    async function initialize() {
      try {
        const root = await appApi.loadRoot();

        if (!mounted) {
          return;
        }

        const rootId = createTreeMethods<Id, Value>().id(root);
        const folds = appApi.stateApi.foldsApi.create(rootId, {
          name: 'default',
          description: null,
        });
        const initialState = appApi.stateApi.create(root, folds, { path: [] });

        if (initialState === undefined) {
          throw new Error('Cannot create initial app state');
        }

        setLoadState({ status: 'ready', appApi, initialState });
      } catch (cause: unknown) {
        if (!mounted) {
          return;
        }

        const error = cause instanceof Error ? cause : new Error(String(cause));
        setLoadState({ status: 'error', appApi, error });
      }
    }

    void initialize();

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

  if (loadState === undefined || loadState.appApi !== appApi) {
    return <LoadingScreenRenderer />;
  }

  if (loadState.status === 'loading') {
    return <LoadingScreenRenderer />;
  }

  if (loadState.status === 'error') {
    throw loadState.error;
  }

  return (
    <App
      screenRenderer={appScreenRenderer}
      shellApi={shellApi}
      appApi={appApi}
      initialization={initialization}
      initialState={loadState.initialState}
      reducer={reducer}
      intentToEffect={intentToEffect}
      effectToAction={effectToAction}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
    />
  );
}
