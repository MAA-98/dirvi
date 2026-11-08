import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { AppApi, Config, FeedbackType, ShellApi } from 'dirvi-apis';
import type {
  AppMethods,
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
import { createFeedbackApi, userInputToIntent } from 'dirvi-lib';

import { useView } from './hooks/useView.js';
import type { AppScreenRenderer } from './app-screen-renderer.js';
import { ExCommand } from '../domain/ex-command.js';

type AppProps<Id extends SerializableKey, Value, ViewKey = string> = {
  screenRenderer: AppScreenRenderer;
  shellApi: ShellApi;
  appMethods: AppMethods<Id, Value, ViewKey>;
  exCommands: ReadonlyMap<string, ExCommand>;
  config: Readonly<Config>;
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
  appMethods,
  exCommands,
  config,
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

  const navEntry: NavBranch<Id, Value> = useMemo(() => {
    const root = appMethods.stateMethods.getRoot(state);
    const folds = appMethods.stateMethods.getFolds(state);
    const navigation = appMethods.navMethods.from(root, folds);

    if (navigation === undefined) {
      throw new Error('Tree-surfer state root must be a loaded branch.');
    }
    return navigation;
  }, [appMethods.navMethods, appMethods.stateMethods, state]);

  const clearInputState: InputModeState = {
    inputMode: 'normal',
    normalBuffer: '',
  };
  const [inputState, setInputState] = useState<InputModeState>(clearInputState);
  const [feedback, setFeedback] = useState<Feedback>();

  const [rowCount, setRowCount] = useState(0);
  const handleRowsChange = useCallback((nextRows: number): void => {
    setRowCount((currentRows) =>
      currentRows === nextRows ? currentRows : nextRows,
    );
  }, []);

  const view = useView(
    navEntry,
    state,
    appMethods.stateMethods,
    appMethods.navMethods,
    appMethods.stateMethods.cursorMethods,
    rowCount,
    appMethods.presentNode,
  );

  // ===========================================================================
  // Resync Subscriptions
  // ===========================================================================
  useEffect(() => {
    let active = true;

    const unsubscribe = appMethods.subscribeToResync(() => {
      const oldState = stateRef.current;

      void appMethods.stateMethods
        .resync(oldState, appMethods.loadChildren)
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
  }, [appMethods, onError]);

  // ===========================================================================
  // App API
  // ===========================================================================

  const feedbackApi = useMemo(
    () =>
      createFeedbackApi((nextFeedback) => {
        setFeedback(nextFeedback);
      }),
    [],
  );

  const appApi = useMemo<AppApi>(
    () => ({
      pathAtCursor: () => appMethods.stateMethods.cursorPath(stateRef.current),
      visiblePaths: () => {
        const state = stateRef.current;
        const root = appMethods.stateMethods.getRoot(state);
        const folds = appMethods.stateMethods.getFolds(state);
        const navigation = appMethods.navMethods.from(root, folds);

        if (navigation === undefined) {
          throw new Error('Tree-surfer state root must be a loaded branch.');
        }

        return navigation.children === null
          ? []
          : appMethods.navMethods.visiblePaths(navigation.children);
      },
      // TODO: Implement with appMethods
      valueAtCursor: () => 'test value',
      addMessage: (message: string, type?: FeedbackType) => {
        feedbackApi.addMessage(message, type);
      },
    }),
    [feedbackApi, appMethods.stateMethods, appMethods.navMethods],
  );

  // ===========================================================================
  // Executing Effects
  // ===========================================================================
  const executeEffect = useCallback(
    (effect: Effect<Id, Value> | undefined): void => {
      if (effect === undefined) {
        return;
      }

      switch (effect.effectType) {
        /** Execute a command, using shell API and app API. */
        case 'userExCommand': {
          setInputState(clearInputState);
          const command = exCommands.get(effect.name);

          if (command === undefined) {
            appApi.addMessage(
              `Command is no longer registered: ${effect.name}`,
              'error',
            );
            return;
          }

          void Promise.resolve()
            .then(() =>
              command.execute({ shell: shellApi, app: appApi }, effect.rawArgs),
            )
            .catch((error: unknown) => {
              const appError =
                error instanceof Error ? error : new Error(String(error));

              appApi.addMessage(
                `Command "${effect.name}" failed: ${appError.message}`,
                'error',
              );
            });

          return;
        }

        case 'quit':
          shellApi.quit(effect.exitMessage);
          return;

        case 'listApps': {
          const appIds = shellApi.listApps();
          setInputState(clearInputState);
          appApi.addMessage(['Apps:', ...appIds].join('\n'));
          return;
        }

        case 'switchApp':
          void shellApi.loadApp(effect.appId, effect.input).then((result) => {
            if (result.kind !== 'loaded') {
              appApi.addMessage(result.message, 'error');
            }
          });
          return;

        case 'dispatchEffectAction':
          const effectActionResult = effectToAction(
            effect.action,
            navEntry,
            state,
          );
          setInputState(clearInputState);

          switch (effectActionResult.kind) {
            case 'action':
              dispatch(effectActionResult.action);
              return;

            case 'rejected':
              appApi.addMessage(effectActionResult.message, 'error');
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
          void appMethods
            .loadChildren(effect.path)
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

              appApi.addMessage(
                `Unable to open directory: ${appError.message}`,
              );
            });

          return;
        }

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

        case 'listFolds': {
          const folds = appMethods.stateMethods.getFolds(state);

          const foldTrees = [
            ...appMethods.stateMethods.foldMethods.indexes(folds),
          ].map((index) => ({
            index,
            info: appMethods.stateMethods.foldMethods.getInfoAtIndex(
              folds,
              index,
            ),
            active: appMethods.stateMethods.foldMethods.isActiveAtIndex(
              folds,
              index,
            ),
          }));

          const indexWidth = Math.max(
            ...foldTrees.map(({ index }) => String(index).length),
          );

          const lines = foldTrees.map(({ index, info, active }) => {
            const status = active === true ? 'active' : 'inactive';
            const name = info?.name ?? '<unavailable>';

            return `${String(index).padStart(indexWidth)}  ${status.padEnd(8)}  ${name}`;
          });

          setInputState(clearInputState);
          appApi.addMessage(['Fold trees:', ...lines].join('\n'));

          return;
        }

        case 'emitError':
          appApi.addMessage(effect.message, 'error');
          return;
      }
    },
    [
      appMethods,
      effectToAction,
      navEntry,
      state,
      shellApi,
      appApi,
      clearInputState,
      exCommands,
    ],
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
      config={config}
      inputState={inputState}
      handleInput={handleInput}
      onRowsChange={handleRowsChange}
    />
  );
}
