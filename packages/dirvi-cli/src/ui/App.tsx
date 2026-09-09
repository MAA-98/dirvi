import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import {
  Effect,
  InputState,
  IntentToEffect,
  State,
  TreeNode,
  userInputToIntent,
} from 'dirvi-lib';

import type { EventMessage } from '../domain/event-message.js';
import { ViewRowComponent } from './components/ViewRowComponent.js';
import { EffectToAction } from '../application/effect-to-action.js';
import { StatusBar } from './components/StatusBar.js';
import { inkInputToUserInput } from '../infrastructure/ink-input-to-user-input.js';
import { AppApi } from '../domain/app-api.js';
import { Reducer } from '../application/reducer.js';
import { useView } from './hooks/useView.js';

type AppProps<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  appApi: AppApi<Name, BufferNode>;
  initialState: State<Name, BufferNode>;
  reducer: Reducer<Name, BufferNode>;
  intentToEffect: IntentToEffect<Name, BufferNode>;
  effectToAction: EffectToAction<Name, BufferNode>;
  print?: (message: EventMessage<Name, BufferNode>) => void;
  onError?: (error: Error) => void;
};

export function App<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>({
  appApi,
  initialState,
  reducer,
  intentToEffect,
  effectToAction,
  print,
  onError,
}: AppProps<Name, BufferNode>) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const navigation = useMemo(
    () => appApi.navNodeApi.from(state.buffer, state.foldNode),
    [appApi.navNodeApi, state.buffer, state.foldNode],
  );

  const [inputState, setInputState] = useState<InputState>({
    inputMode: 'normal',
    normalBuffer: '',
  });

  const { rows: terminalRows } = useWindowSize();
  const view = useView(
    navigation,
    state,
    terminalRows,
    appApi.treeNodeApi.nameEquals,
  );
  const [exitStatus, setExitStatus] = useState<string | undefined>();

  // Print on changes: view, paths of visible leaves
  useEffect(() => {
    print?.({ type: 'view', view: state });

    const visibleLeavesPaths = appApi.navNodeApi.visibleLeavesPaths(navigation);

    print?.({
      type: 'displayed-leaves-paths',
      paths: visibleLeavesPaths,
    });
  }, [appApi.navNodeApi, state, print, navigation]);

  // Subscribe to directory watcher
  useEffect(() => {
    let active = true;

    const unsubscribe = appApi.subscribeToResync(() => {
      const oldState = stateRef.current;

      void appApi.stateApi
        .resync(oldState, appApi.loadBranches)
        .then((nextState) => {
          if (!active) {
            return;
          }

          dispatch({
            kind: 'updateBuffer',
            oldEntries: oldState.buffer,
            entries: nextState.buffer,
          });
        })
        .catch((error: unknown) => {
          const appError =
            error instanceof Error ? error : new Error(String(error));

          onError?.(appError);
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [appApi, onError]);

  function executeEffect(effect: Effect<Name, BufferNode> | undefined): void {
    if (effect === undefined) {
      return;
    }

    switch (effect.effectType) {
      case 'dispatchEffectAction':
        const action = effectToAction(effect.action, navigation, state);
        if (action === undefined) {
          return;
        }
        dispatch(action);
        setInputState({
          inputMode: 'normal',
          normalBuffer: '',
        });
        return;

      case 'setInputState':
        setInputState(effect.inputState);
        return;

      case 'loadBranchEntries': {
        void appApi
          .loadBranches(effect.path)
          .then((entries) => {
            dispatch({
              kind: 'updateBranch',
              path: effect.path,
              entries,
            });
          })
          .catch((error: unknown) => {
            const appError =
              error instanceof Error ? error : new Error(String(error));

            onError?.(appError);
            setExitStatus(`Unable to open directory: ${appError.message}`);
          });

        return;
      }

      case 'emitPath':
        print?.({
          type: 'file',
          path: effect.path,
        });
        return;

      case 'quit':
        setExitStatus(effect.exitMessage);
        return;
    }
  }

  // --- Input Hook ---
  useInput((input, key) => {
    const userInput = inkInputToUserInput(input, key);
    if (userInput === undefined) {
      return;
    }

    const intent = userInputToIntent(userInput, inputState);
    if (intent === undefined) {
      return;
    }

    const effectResult = intentToEffect(intent, state);
    if (effectResult === undefined) {
      return;
    }

    executeEffect(effectResult);
  });

  // --- Exit Logic ---
  const { exit } = useApp();
  useEffect(() => {
    if (exitStatus === undefined) {
      return;
    }

    if (exitStatus !== '') {
      onError?.(new Error(exitStatus));
    }

    exit();
  }, [exitStatus, exit, onError]);

  if (exitStatus !== undefined) {
    return null;
  }

  // --- JSX ---
  return (
    <Box flexDirection="column" height={terminalRows}>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {view.rows.length === 0 ? (
          <Text dimColor>Empty.</Text>
        ) : (
          view.rows.map((row) => <ViewRowComponent key={row.id} row={row} />)
        )}
      </Box>

      <StatusBar inputState={inputState} />
    </Box>
  );
}
