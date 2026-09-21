import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import {
  Effect,
  InputState,
  IntentToEffect,
  SerializableKey,
  State,
  TreeNode,
  userInputToIntent,
} from 'dirvi-lib';

import { ViewRowComponent } from './components/ViewRowComponent.js';
import { EffectToAction } from '../application/effect-to-action.js';
import { StatusBar } from './components/StatusBar.js';
import { inkInputToUserInput } from '../infrastructure/ink-input-to-user-input.js';
import { AppApi } from '../domain/app-api.js';
import { Reducer } from '../application/reducer.js';
import { useView } from './hooks/useView.js';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

type AppProps<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
  ViewKey = string,
> = {
  appApi: AppApi<Id, BufferNode, ViewKey>;
  initialState: State<Id, BufferNode>;
  reducer: Reducer<Id, BufferNode>;
  intentToEffect: IntentToEffect<Id, BufferNode>;
  effectToAction: EffectToAction<Id, BufferNode>;
  stdout?: (message: string) => void;
  clipboard?: (value: string) => void;
  onError?: (error: Error) => void;
};

export function App<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
  ViewKey = string,
>({
  appApi,
  initialState,
  reducer,
  intentToEffect,
  effectToAction,
  stdout,
  clipboard,
  onError,
}: AppProps<Id, BufferNode, ViewKey>) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Give `subscribeToResync` callback a way to see current state:
  const stateRef = useRef(state);
  stateRef.current = state;

  const navigation = useMemo(
    () => appApi.navNodeApi.from(state.root, state.foldNode),
    [appApi.navNodeApi, state.root, state.foldNode],
  );

  const [inputState, setInputState] = useState<InputState>({
    inputMode: 'normal',
    normalBuffer: '',
  });

  const { rows: terminalRows } = useWindowSize();
  const view = useView(navigation, state, appApi.cursorApi, terminalRows);
  const [exitStatus, setExitStatus] = useState<string | undefined>();

  // Subscribe to directory watcher, do not
  // resubscribe on every state change.
  useEffect(() => {
    let active = true;

    const unsubscribe = appApi.subscribeToResync(() => {
      const oldState = stateRef.current;

      void appApi.stateApi
        .resync(oldState, appApi.loadBranches)
        .then((newState) => {
          if (!active) {
            return;
          }

          dispatch({
            kind: 'setState',
            oldState: oldState,
            newState: newState,
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

  function executeEffect(effect: Effect<Id, BufferNode> | undefined): void {
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

      case 'peekFold':
        // TODO: Need a peek state to know what to display
        return
        
      case 'emitVisibleLeavesPaths':
        const visibleLeavesPaths =
          appApi.navNodeApi.visibleLeavesPaths(navigation);
        stdout?.(
          JSON.stringify({
            type: 'displayed-leaves-paths',
            paths: visibleLeavesPaths,
          }),
        );
        setInputState({
          inputMode: 'normal',
          normalBuffer: '',
        });
        return;

      case 'saveView': {
        void appApi.viewApi
          .save(appApi.viewKey, effect.name, stateRef.current)
          .then(() => {
            setInputState({
              inputMode: 'normal',
              normalBuffer: '',
            });
          })
          .catch((error: unknown) => {
            onError?.(toError(error));
            setExitStatus(`Unable to save view: ${toError(error).message}`);
          });

        return;
      }

      case 'loadView': {
        void appApi.viewApi
          .load(appApi.viewKey, effect.name)
          .then((loadedState) => {
            if (loadedState === undefined) {
              throw new Error(`View not found: ${effect.name}`);
            }

            // The saved buffer may be stale because the filesystem could have
            // changed since the view was saved.
            return appApi.stateApi.resync(loadedState, appApi.loadBranches);
          })
          .then((newState) => {
            const oldState = stateRef.current;

            dispatch({
              kind: 'setState',
              oldState,
              newState,
            });

            setInputState({
              inputMode: 'normal',
              normalBuffer: '',
            });
          })
          .catch((error: unknown) => {
            onError?.(toError(error));
          });

        return;
      }

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
