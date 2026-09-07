import { Text } from 'ink';
import { useEffect, useState } from 'react';

import { PosixName, PosixNode, State, TreeNode } from 'dirvi-lib';

import type { EventMessage } from '../domain/event-message.js';
import { App } from './App.js';
import { AppApi } from '../domain/app-api.js';
import { createReducer } from '../application/reducer.js';

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
// export function LoadingApp<
//   Name extends PropertyKey,
//   BufferNode extends TreeNode<Name, BufferNode>,
// >({
//   appApi,
//   print,
//   onError
// }: LoadingAppProps<Name, BufferNode>) {
//   const [initialState, setInitialState] = useState<
//     State<Name, BufferNode> | undefined
//   >();
export function LoadingApp({
  appApi,
  print,
  onError,
}: LoadingAppProps<PosixName, PosixNode>) {
  const [initialState, setInitialState] = useState<
    State<PosixName, PosixNode> | undefined
  >();
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
      reducer={createReducer(appApi.treeNodeApi, appApi.foldNodeApi)}
      print={print}
      onError={onError}
    />
  );
}
