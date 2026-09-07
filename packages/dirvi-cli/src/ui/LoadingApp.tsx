import { Text } from 'ink';
import { useEffect, useMemo, useState } from 'react';

import { createIntentToEffect, State, TreeNode } from 'dirvi-lib';

import type { EventMessage } from '../domain/event-message.js';
import { App } from './App.js';
import { AppApi } from '../domain/app-api.js';
import { createReducer } from '../application/reducer.js';
import { createEffectToAction } from '../application/effect-to-action.js';

type LoadingAppProps<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  appApi: AppApi<Name, BufferNode>;
  print?: (message: EventMessage<Name, BufferNode>) => void;
  onError?: (error: Error) => void;
};

function createInitialState<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  rootBranches: State<Name, BufferNode>['buffer'],
  createEmptyFoldNode: () => State<Name, BufferNode>['foldNode'],
): State<Name, BufferNode> {
  if (rootBranches.length === 0) {
    throw new Error(
      'createInitialState cannot create a state for an empty forest',
    );
  }

  return {
    buffer: rootBranches,
    foldNode: createEmptyFoldNode(),
    cursor: {
      kind: 'entry',
      parentPath: [],
      entryName: rootBranches[0].name,
    },
  };
}

// Loads the initial state and other dependencies of the
// App given the AppApi. Because the reducer doesn't change
// with state, we create it here rather than in App.
//
// Displays the given message if the initial tree nodes are empty.
export function LoadingApp<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>({ appApi, print, onError }: LoadingAppProps<Name, BufferNode>) {
  const [initialState, setInitialState] = useState<State<Name, BufferNode>>();
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
          createInitialState(rootBranches, appApi.foldNodeApi.createEmpty),
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

  // Pure function deps
  const reducer = useMemo(
    () => createReducer(appApi.treeNodeApi, appApi.foldNodeApi),
    [appApi.treeNodeApi, appApi.foldNodeApi],
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
    () => createEffectToAction(appApi.navNodeApi, appApi.treeNodeApi),
    [appApi.navNodeApi, appApi.treeNodeApi],
  );

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
      print={print}
      onError={onError}
    />
  );
}
