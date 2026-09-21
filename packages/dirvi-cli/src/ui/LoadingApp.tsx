import { Text } from 'ink';
import { useEffect, useMemo, useState } from 'react';

import {
  createIntentToEffect,
  SerializableKey,
  State,
  TreeNode,
} from 'dirvi-lib';

import { App } from './App.js';
import { AppApi } from '../domain/app-api.js';
import { createReducer } from '../application/reducer.js';
import { createEffectToAction } from '../application/effect-to-action.js';

type LoadingAppProps<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
  ViewKey = string,
> = {
  appApi: AppApi<Id, BufferNode, ViewKey>;
  stdout?: (message: string) => void;
  clipboard?: (value: string) => void;
  onError?: (error: Error) => void;
};

function createInitialState<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  rootBranches: State<Id, BufferNode>['buffer'],
  createEmptyFoldRoot: () => State<Id, BufferNode>['foldNode'],
): State<Id, BufferNode> {
  if (rootBranches.length === 0) {
    throw new Error(
      'createInitialState cannot create a state for an empty forest',
    );
  }

  return {
    buffer: rootBranches,
    foldNode: createEmptyFoldRoot(),
    cursor: {
      parentPath: [],
      entryId: rootBranches[0]!.id,
    },
  };
}

export function LoadingApp<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
  ViewKey = string,
>({
  appApi,
  stdout,
  clipboard,
  onError,
}: LoadingAppProps<Id, BufferNode, ViewKey>) {
  const [initialState, setInitialState] = useState<State<Id, BufferNode>>();
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let mounted = true;

    appApi
      .loadBranches([])
      .then((rootBranches) => {
        if (!mounted) {
          return;
        }

        if (rootBranches.length === 0) {
          setEmpty(true);
          return;
        }

        setInitialState(
          createInitialState(rootBranches, () =>
            appApi.foldNodeService.createEmptyRoot(),
          ),
        );
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
    () => createReducer(appApi.treeNodeApi, appApi.foldNodeService),
    [appApi.treeNodeApi, appApi.foldNodeService],
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
    () =>
      createEffectToAction(
        appApi.treeNodeApi,
        appApi.cursorApi,
        appApi.navNodeApi,
      ),
    [appApi.treeNodeApi, appApi.navNodeApi, appApi.cursorApi],
  );

  // --- JSX ---

  if (error !== undefined) {
    return <Text color="red">{error.message}</Text>;
  }

  if (empty) {
    return <Text dimColor>{appApi.emptyForestMessage}</Text>;
  }

  if (initialState === undefined) {
    return <Text dimColor>Loading.</Text>;
  }

  return (
    <App
      appApi={appApi}
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
