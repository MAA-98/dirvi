import { useEffect, useMemo, useState } from 'react';

import type { HighlightResolver, ShellApi } from 'dirvi-apis';
import type { AppMethods, State } from 'dirvi-lib';
import { createTreeMethods } from 'dirvi-lib';
import {
  createEffectToAction,
  createIntentToEffect,
  createReducer,
} from 'dirvi-lib';

import type { LoadingScreenRenderer } from './loading-screen-renderer.js';
import type { AppScreenRenderer } from './app-screen-renderer.js';
import type { Initialization } from '../domain/initialization.js';
import type { ExCommand, NormalCommand } from '../domain/command.js';
import { App } from './App.js';

// TODO Later: configuration watched for changes

const emptyExCommands: ReadonlyMap<string, ExCommand> = new Map();
const emptyNormalCommands: ReadonlyMap<string, NormalCommand> = new Map();
const emptyHighlightResolver: HighlightResolver = (_string) => undefined;

type AppSetupProps<Id, Value, ViewKey = string> = {
  appScreenRenderer: AppScreenRenderer;
  loadingScreenRenderer: LoadingScreenRenderer;
  appId: string;
  initialization: Initialization;
  shellApi: ShellApi;
  appMethods: AppMethods<Id, Value, ViewKey>;
  clipboard?: (value: string) => void;
};

type LoadState<Id, Value, ViewKey> =
  | {
      status: 'loading';
      appMethods: AppMethods<Id, Value, ViewKey>;
    }
  | {
      status: 'ready';
      appMethods: AppMethods<Id, Value, ViewKey>;
      initialState: State<Id, Value>;
    }
  | {
      status: 'error';
      appMethods: AppMethods<Id, Value, ViewKey>;
      error: Error;
    };

export function AppSetup<Id, Value, ViewKey = string>({
  appScreenRenderer,
  loadingScreenRenderer,
  appId,
  initialization,
  shellApi,
  appMethods,
  clipboard,
}: AppSetupProps<Id, Value, ViewKey>) {
  const [loadState, setLoadState] = useState<LoadState<Id, Value, ViewKey>>();

  useEffect(() => {
    let mounted = true;

    setLoadState({ status: 'loading', appMethods: appMethods });

    async function initialize() {
      try {
        const root = await appMethods.loadRoot();

        if (!mounted) {
          return;
        }

        const rootId = createTreeMethods<Id, Value>().id(root);
        const folds = appMethods.stateMethods.foldMethods.create(rootId, {
          name: 'default',
          description: null,
        });
        const initialState = appMethods.stateMethods.create(root, folds, {
          path: [],
        });

        if (initialState === undefined) {
          throw new Error('Cannot create initial app state');
        }

        setLoadState({ status: 'ready', appMethods: appMethods, initialState });
      } catch (cause: unknown) {
        if (!mounted) {
          return;
        }

        const error = cause instanceof Error ? cause : new Error(String(cause));
        setLoadState({ status: 'error', appMethods: appMethods, error });
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [appMethods]);

  // --- Pure function deps ---
  const normalCommands = useMemo(
    () => initialization.normalCommands.get(appId) ?? emptyNormalCommands,
    [initialization.normalCommands, appId],
  );
  const exCommands = useMemo(
    () => initialization.exCommands.get(appId) ?? emptyExCommands,
    [initialization.exCommands, appId],
  );

  const highlightResolver = useMemo(
    () =>
      initialization.highlightResolvers.get(appId) ?? emptyHighlightResolver,
    [initialization.highlightResolvers, appId],
  );

  const reducer = useMemo(
    () => createReducer(appMethods.stateMethods, appMethods.navMethods),
    [appMethods.stateMethods, appMethods.navMethods],
  );

  const intentToEffect = useMemo(
    () =>
      createIntentToEffect(
        new Set(normalCommands.keys()),
        new Set(exCommands.keys()),
        appMethods.stateMethods,
      ),
    [appMethods.stateMethods, exCommands, normalCommands],
  );

  const effectToAction = useMemo(
    () => createEffectToAction(appMethods.stateMethods, appMethods.navMethods),
    [appMethods.navMethods, appMethods.stateMethods],
  );

  // --- JSX ---
  const LoadingScreenRenderer = loadingScreenRenderer;

  if (loadState === undefined || loadState.appMethods !== appMethods) {
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
      appMethods={appMethods}
      exCommands={exCommands}
      normalCommands={normalCommands}
      highlightResolver={highlightResolver}
      config={initialization.config}
      initialState={loadState.initialState}
      reducer={reducer}
      intentToEffect={intentToEffect}
      effectToAction={effectToAction}
      {...(clipboard === undefined ? {} : { clipboard })}
    />
  );
}
