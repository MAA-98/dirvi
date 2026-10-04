import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { createFeedbackApi, userInputToIntent } from 'dirvi-lib';
import type {
  AppApi,
  Effect,
  EffectToAction,
  InputModeState,
  IntentToEffect,
  NavBranch,
  Reducer,
  SerializableKey,
  State,
  Feedback,
} from 'dirvi-lib';

import type { Config } from '../domain/config.js';
import { ViewRowComponent } from './components/ViewRowComponent.js';
import { FeedbackBar } from './components/FeedbackBar.js';
import { STATUS_BAR_HEIGHT, StatusBar } from './components/StatusBar.js';
import { useView } from './hooks/useView.js';
import { inkInputToUserInput } from '../infrastructure/ink-input-to-user-input.js';
import { createFeedbackDisplay } from './components/feedback-display.js';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

type AppProps<Id extends SerializableKey, Value, ViewKey = string> = {
  appApi: AppApi<Id, Value, ViewKey>;
  config: Config;
  initialState: State<Id, Value>;
  reducer: Reducer<Id, Value>;
  intentToEffect: IntentToEffect<Id, Value>;
  effectToAction: EffectToAction<Id, Value>;
  stdout?: (message: string) => void;
  clipboard?: (value: string) => void;
  onError?: (error: Error) => void;
};

export function App<Id extends SerializableKey, Value, ViewKey = string>({
  appApi,
  config,
  initialState,
  reducer,
  intentToEffect,
  effectToAction,
  stdout,
  clipboard,
  onError,
}: AppProps<Id, Value, ViewKey>) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Give `subscribeToResync` callback a way to see current state:
  const stateRef = useRef(state);
  stateRef.current = state;
  
  const navEntry: NavBranch<Id> = useMemo(() => {
    const navigation = appApi.navNodeApi.from(state.root, state.folds);

    /*
     * State's root invariant requires an open branch. A missing navigation
     * root therefore means an invalid State was constructed or decoded.
     */
    if (navigation === undefined) {
      throw new Error('Tree-surfer state root must be a loaded branch.');
    }

    return navigation;
  }, [appApi.navNodeApi, state.root, state.folds]);

  const [inputState, setInputState] = useState<InputModeState>({
    inputMode: 'normal',
    normalBuffer: '',
  });
  
  const [feedback, setFeedback] = useState<Feedback>();
  const feedbackApi = useMemo(
    () =>
      createFeedbackApi((nextFeedback) => {
        setFeedback(nextFeedback);
      }),
    [],
  );
  
  const { columns: terminalColumns, rows: terminalRows } = useWindowSize();
  const feedbackDisplay = useMemo(() => {
    if (feedback === undefined) {
      return {
        content: '',
        height: 0,
      };
    }

    return createFeedbackDisplay(
      feedbackApi.getMessage(feedback),
      terminalColumns,
      Math.max(0, terminalRows - STATUS_BAR_HEIGHT),
    );
  }, [feedback, terminalColumns, terminalRows]);
  const view = useView(
    navEntry,
    state,
    appApi.navNodeApi,
    appApi.cursorApi,
    terminalRows,
    feedbackDisplay.height,
  );
  const [exitStatus, setExitStatus] = useState<string | undefined>();

  // Subscribe to directory watcher, do not resubscribe on every state change.
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

  function executeEffect(effect: Effect<Id, Value> | undefined): void {
    if (effect === undefined) {
      return;
    }

    switch (effect.effectType) {
      case 'dispatchEffectAction':
        const action = effectToAction(effect.action, navEntry, state);
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
            
            feedbackApi.addMessage(
              `Unable to open directory: ${appError.message}`,
            );
          });

        return;
      }

      case 'emitVisibleLeavesPaths':
        const navigation = navEntry.children;

        if (navigation === null) {
          return;
        }

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
            feedbackApi.addMessage(`Saved view: ${effect.name}`);
          })
          .catch((error: unknown) => {
            feedbackApi.addMessage(
              `Unable to save view: ${toError(error).message}`,
            );
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
      
      case 'unrecognizedCommand':
        setInputState({
          inputMode: 'normal',
          normalBuffer: '',
        });
        feedbackApi.addMessage(
          `Unrecognized command: ${effect.commandLine}`,
        );
        return;

      case 'quit':
        setExitStatus(effect.exitMessage);
        return;
    }
  }

  // --- Ink Input Hook ---
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
    
    setFeedback(undefined);
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
      
      <FeedbackBar display={feedbackDisplay} />
      <StatusBar inputState={inputState} config={config} />
    </Box>
  );
}
