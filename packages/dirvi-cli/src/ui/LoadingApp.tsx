import { Text } from 'ink';
import { useEffect, useMemo, useState } from 'react';

import { createEffectToAction, createIntentToEffect, createReducer } from 'dirvi-lib';
import type { AppApi, SerializableKey, State } from 'dirvi-lib';

import { App } from './App.js';
import { ConfigApi } from '../application/config-api.js';
import { Config } from '../domain/config.js';

type LoadingAppProps<
  Id extends SerializableKey,
  Value,
  ViewKey = string,
> = {
  appApi: AppApi<Id, Value, ViewKey>;
  configApi: ConfigApi;
  stdout?: (message: string) => void;
  clipboard?: (value: string) => void;
  onError?: (error: Error) => void;
};

export function LoadingApp<
  Id extends SerializableKey,
  Value,
  ViewKey = string,
>({
  appApi,
  configApi,
  stdout,
  clipboard,
  onError,
}: LoadingAppProps<Id, Value, ViewKey>) {
  const [initialState, setInitialState] = useState<State<Id, Value>>();
  const [config, setConfig] = useState<Config>();
  const [error, setError] = useState<Error>();

  // Load the initial configuration and keep it synchronized with changes made
  // by another process or another running direx instance.
  useEffect(() => {
    let mounted = true;
    let latestLoad = 0;

    const loadConfig = (): void => {
      const loadNumber = ++latestLoad;

      void configApi
        .load()
        .then((nextConfig) => {
          // Ignore a stale read if a newer config read has begun meanwhile.
          if (!mounted || loadNumber !== latestLoad) {
            return;
          }

          setConfig(nextConfig);
        })
        .catch((cause: unknown) => {
          if (!mounted || loadNumber !== latestLoad) {
            return;
          }

          const nextError =
            cause instanceof Error ? cause : new Error(String(cause));

          setError(nextError);
          onError?.(nextError);
        });
    };

    // Subscribe before the first load so a change during startup is not missed.
    const unsubscribe = configApi.subscribeToResync(loadConfig);
    loadConfig();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [configApi, onError]);

  // Loading and setting initial state.
  useEffect(() => {
    let mounted = true;

    appApi
      .createRoot()
      .then((root) => {
        if (!mounted) {
          return;
        }
        
        setInitialState({
          root,
          folds: appApi.foldsApi.create(appApi.rootId, {
            name: 'default',
            description: null,
          }),
          cursor: [],
        });
      })
      .catch((cause: unknown) => {
        const nextError =
          cause instanceof Error ? cause : new Error(String(cause));

        if (!mounted) {
          return;
        }

        setError(nextError);
        onError?.(nextError);
      });

    return () => {
      mounted = false;
    };
  }, [appApi, onError]);

  // --- Pure function deps ---
  
  const reducer = useMemo(
    () => createReducer(appApi.treeNodeApi, appApi.foldsApi),
    [appApi.treeNodeApi, appApi.foldsApi],
  );
  
  const intentToEffect = useMemo(
    () =>
      createIntentToEffect(
        appApi.stateApi,
        appApi.cursorApi,
        appApi.treeNodeApi,
      ),
    [appApi.stateApi, appApi.cursorApi, appApi.treeNodeApi],
  );
  
  const effectToAction = useMemo(
    () => createEffectToAction(appApi.foldsApi , appApi.cursorApi, appApi.navNodeApi),
    [appApi.navNodeApi, appApi.cursorApi, appApi.foldsApi],
  );

  // --- JSX ---

  if (error !== undefined) {
    return <Text color="red">{error.message}</Text>;
  }

  if (initialState === undefined || config === undefined) {
    return <Text dimColor>Loading.</Text>;
  }

  return (
    <App
      appApi={appApi}
      config={config}
      initialState={initialState}
      reducer={reducer}
      intentToEffect={intentToEffect}
      effectToAction={effectToAction}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
      {...(onError === undefined ? {} : { onError })}
    />
  );
}
