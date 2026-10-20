import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

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
  UserInput,
} from 'dirvi-lib';

import { useView } from './hooks/useView.js';
import type { AppScreenRenderer } from './app-screen-renderer.js';
import { ShellApi } from '../domain/shell-api.js';
import { Initialization } from '../domain/initialization.js';

type AppProps<Id extends SerializableKey, Value, ViewKey = string> = {
  screenRenderer: AppScreenRenderer;
  shellApi: ShellApi;
  appApi: AppApi<Id, Value, ViewKey>;
  initialization: Initialization;
  initialState: State<Id, Value>;
  reducer: Reducer<Id, Value>;
  intentToEffect: IntentToEffect<Id, Value>;
  effectToAction: EffectToAction<Id, Value>;
  stdout?: (message: string) => void;
  clipboard?: (value: string) => void;
  onError?: (error: Error) => void;
};

export function App<Id extends SerializableKey, Value, ViewKey = string>({
  screenRenderer,
  shellApi,
  appApi,
  initialization,
  initialState,
  reducer,
  intentToEffect,
  effectToAction,
  stdout,
  clipboard,
  onError,
}: AppProps<Id, Value, ViewKey>) {
  const ScreenRenderer = screenRenderer;
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state); // Gives `subscribeToResync` callback a way to
  // see current state
  stateRef.current = state;

  const navEntry: NavBranch<Id> = useMemo(() => {
    const navigation = appApi.navNodeApi.from(state.root, state.folds);

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
  const [exitStatus, setExitStatus] = useState<string | undefined>();

  const [rowCount, setRowCount] = useState(0);
  const handleRowsChange = useCallback((nextRows: number): void => {
    setRowCount((currentRows) =>
      currentRows === nextRows ? currentRows : nextRows,
    );
  }, []);

  // ===========================================================================
  // Display hooks
  // ===========================================================================
  const feedbackApi = useMemo(
    () =>
      createFeedbackApi((nextFeedback) => {
        setFeedback(nextFeedback);
      }),
    [],
  );

  const view = useView(
    navEntry,
    state,
    appApi.navNodeApi,
    appApi.cursorApi,
    rowCount,
  );

  // ===========================================================================
  // Resync Subscriptions
  // ===========================================================================
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

  // ===========================================================================
  // Executing Effects
  // ===========================================================================
  const executeEffect = useCallback(
    (effect: Effect<Id, Value> | undefined): void => {
      if (effect === undefined) {
        return;
      }

      switch (effect.effectType) {
        case 'userExCommand': {
          setInputState({
            inputMode: 'normal',
            normalBuffer: '',
          });
          const command = initialization.exCommands.get(effect.name);
          
          if (command === undefined) {
            feedbackApi.addMessage(
              `Command is no longer registered: ${effect.name}`,
              'error',
            );
            return;
          }
          void Promise.resolve()
            .then(() => command.execute({ shell: shellApi })) // TODO: Add args
            .catch((error: unknown) => {
              const appError =
                error instanceof Error ? error : new Error(String(error));
              
              feedbackApi.addMessage(
                `Command "${effect.name}" failed: ${appError.message}`,
                'error',
              );
            });
          
          return;
        }
        
        case 'quit':
          setExitStatus(effect.exitMessage);
          return;

        case 'listApps': {
          const appIds = [...initialization.app.registered.keys()];
          const lines = appIds.map((id) => `${id}`);

          setInputState({
            inputMode: 'normal',
            normalBuffer: '',
          });
          feedbackApi.addMessage(['Apps:', ...lines].join('\n'));

          return;
        }
        
        case 'switchApp':
          void shellApi.openApp(effect.appId, effect.input)
          return

        case 'dispatchEffectAction':
          const effectActionResult = effectToAction(
            effect.action,
            navEntry,
            state,
          );

          // A completed normal-mode command or submitted Ex command always
          // leaves its input buffer, whether it succeeds, is rejected, or no-ops.
          setInputState({
            inputMode: 'normal',
            normalBuffer: '',
          });

          switch (effectActionResult.kind) {
            case 'action':
              dispatch(effectActionResult.action);
              return;

            case 'rejected':
              feedbackApi.addMessage(effectActionResult.message, 'error');
              return;

            case 'ignored':
              return;

            default:
              return;
          }

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
          // void appApi.viewApi
          //   .save(appApi.viewKey, effect.name, stateRef.current)
          //   .then(() => {
          //     setInputState({
          //       inputMode: 'normal',
          //       normalBuffer: '',
          //     });
          //     feedbackApi.addMessage(`Saved view: ${effect.name}`);
          //   })
          //   .catch((error: unknown) => {
          //     feedbackApi.addMessage(
          //       `Unable to save view: ${toError(error).message}`,
          //     );
          //   });

          return;
        }

        case 'loadView': {
          // void appApi.viewApi
          //   .load(appApi.viewKey, effect.name)
          //   .then((loadedState) => {
          //     if (loadedState === undefined) {
          //       throw new Error(`View not found: ${effect.name}`);
          //     }
          //
          //     // The saved buffer may be stale because the filesystem could have
          //     // changed since the view was saved.
          //     return appApi.stateApi.resync(loadedState, appApi.loadBranches);
          //   })
          //   .then((newState) => {
          //     const oldState = stateRef.current;
          //
          //     dispatch({
          //       kind: 'setState',
          //       oldState,
          //       newState,
          //     });
          //
          //     setInputState({
          //       inputMode: 'normal',
          //       normalBuffer: '',
          //     });
          //   })
          //   .catch((error: unknown) => {
          //     onError?.(toError(error));
          //   });

          return;
        }

        // TODO: Add descriptions with `...` truncation.
        case 'listFolds': {
          const folds = state.folds;

          const foldTrees = [...appApi.foldsApi.indexes(folds)].map(
            (index) => ({
              index,
              info: appApi.foldsApi.getInfoAtIndex(folds, index),
              active: appApi.foldsApi.isActiveAtIndex(folds, index),
            }),
          );

          const indexWidth = Math.max(
            ...foldTrees.map(({ index }) => String(index).length),
          );

          const lines = foldTrees.map(({ index, info, active }) => {
            const status = active === true ? 'active' : 'inactive';
            const name = info?.name ?? '<unavailable>';

            return `${String(index).padStart(indexWidth)}  ${status.padEnd(8)}  ${name}`;
          });

          setInputState({
            inputMode: 'normal',
            normalBuffer: '',
          });
          feedbackApi.addMessage(['Fold trees:', ...lines].join('\n'));

          return;
        }

        case 'emitError':
          feedbackApi.addMessage(
            effect.message,
            'error',
          );
          return;
      }
    },
    [appApi, effectToAction, feedbackApi, navEntry, state, stdout, initialization.app.registered, shellApi],
  );

  // ===========================================================================
  // Input hook
  // ===========================================================================
  const handleInput = useCallback(
    (userInput: UserInput) => {
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
    },
    [executeEffect, inputState, intentToEffect, state],
  );

  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <ScreenRenderer
      view={view}
      feedback={feedback}
      feedbackApi={feedbackApi}
      config={initialization.config}
      inputState={inputState}
      handleInput={handleInput}
      onRowsChange={handleRowsChange}
      exitStatus={exitStatus}
    />
  );
}
