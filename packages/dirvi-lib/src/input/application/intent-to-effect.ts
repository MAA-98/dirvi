import type {
  CursorApi,
  SerializableKey,
  State,
  StateApi,
  TreeNodeApi,
} from '../../trees/index.js';
import type { Effect, EffectAction, Intent } from '../domain/index.js';

import { parseCommand } from './parse-command.js';

/**
 * Converts a user intent and the current tree state into an effect.
 *
 * By design, "effect = intent + state": whether an effect should be executed
 * depends on both the received intent and the current state.
 *
 * @typeParam Id - The sibling-unique tree-node ID type.
 * @typeParam Value - Application-owned data stored in each tree node.
 */
export type IntentToEffect<Id extends SerializableKey, Value> = (
  intent: Intent,
  state: State<Id, Value>,
) => Effect<Id, Value> | undefined;

export function createIntentToEffect<Id extends SerializableKey, Value>(
  stateApi: StateApi<Id, Value>,
  cursorApi: CursorApi<Id>,
  treeNodeApi: TreeNodeApi<Id, Value>,
): IntentToEffect<Id, Value> {
  return (intent, state) => {
    switch (intent.intentType) {
      case 'setNormalBuffer':
        return normalBufferToEffectResult<Id, Value>(intent.normalBuffer);

      case 'normalRight':
        return normalInteractRightToEffect(
          state,
          stateApi,
          cursorApi,
          treeNodeApi,
        );

      case 'normalLeft':
        return normalInteractLeftToEffect(state, cursorApi);

      case 'normalDown':
        return dispatchAction<Id, Value>({
          effectActionType: 'nextEntry',
        });

      case 'normalUp':
        return dispatchAction<Id, Value>({
          effectActionType: 'prevEntry',
        });

      case 'enterCommandLineMode':
        return {
          effectType: 'setInputState',
          inputState: {
            inputMode: 'command',
            commandLine: ':',
          },
        };

      case 'setCommandLine':
        return {
          effectType: 'setInputState',
          inputState: {
            inputMode: 'command',
            commandLine: intent.commandLine,
          },
        };

      case 'exitCommandLineMode':
        return {
          effectType: 'setInputState',
          inputState: {
            inputMode: 'normal',
            normalBuffer: '',
          },
        };

      case 'executeCommandLine':
        return (
          parseCommand(intent.commandLine) ?? {
            effectType: 'setInputState',
            inputState: {
              inputMode: 'normal',
              normalBuffer: '',
            },
          }
        );
    }
  };
}

function dispatchAction<Id extends SerializableKey, Value>(
  action: EffectAction<Id, Value>,
): Effect<Id, Value> {
  return {
    effectType: 'dispatchEffectAction',
    action,
  };
}

/**
 * Sets the normal-mode command buffer.
 *
 * Three possibilities:
 *
 * - The buffer is a recognized motion: dispatch its effect action.
 * - The buffer is a prefix of a possible motion: retain it.
 * - The buffer is not a valid prefix: clear it.
 */
function normalBufferToEffectResult<Id extends SerializableKey, Value>(
  updatedNormalBuffer: string,
): Effect<Id, Value> {
  switch (updatedNormalBuffer) {
    // =========================================================================
    // Fold
    // =========================================================================
    case 'z':
      return {
        effectType: 'setInputState',
        inputState: {
          inputMode: 'normal',
          normalBuffer: updatedNormalBuffer,
        },
      };

    case 'zf':
      return dispatchAction<Id, Value>({
        effectActionType: 'addToFoldTree',
        foldTree: {
          foldTreeReferenceType: 'index',
          index: 0,
        },
      });

    case 'zd':
      return dispatchAction<Id, Value>({
        effectActionType: 'removeFromFoldTree',
        foldTree: {
          foldTreeReferenceType: 'index',
          index: 0,
        },
      });

    case 'zc':
      return dispatchAction<Id, Value>({
        effectActionType: 'fold',
        foldTree: {
          foldTreeReferenceType: 'index',
          index: 0,
        },
      });

    case 'zo':
      return dispatchAction<Id, Value>({
        effectActionType: 'unfold',
        foldTree: {
          foldTreeReferenceType: 'index',
          index: 0,
        },
      });

    case 'za':
      return dispatchAction<Id, Value>({
        effectActionType: 'toggleFold',
        foldTree: {
          foldTreeReferenceType: 'index',
          index: 0,
        },
      });

    default:
      return {
        effectType: 'setInputState',
        inputState: {
          inputMode: 'normal',
          normalBuffer: '',
        },
      };
  }
}

/**
 * Handles normal-mode right interaction.
 *
 * - A closed branch requests loading its children.
 * - An open branch dispatches an action that closes/unloads its children.
 * - A leaf has no right-interaction effect.
 */
function normalInteractRightToEffect<Id extends SerializableKey, Value>(
  state: State<Id, Value>,
  stateApi: StateApi<Id, Value>,
  cursorApi: CursorApi<Id>,
  treeNodeApi: TreeNodeApi<Id, Value>,
): Effect<Id, Value> | undefined {
  const currentEntry = stateApi.getNodeAtCursor(state);

  if (currentEntry === undefined) {
    return undefined;
  }

  const path = cursorApi.getPath(state.cursor);

  if (path === undefined) {
    return undefined;
  }

  switch (treeNodeApi.kind(currentEntry)) {
    case 'unloaded-branch':
      return {
        effectType: 'loadBranchEntries',
        path,
      };

    case 'loaded-branch':
      return dispatchAction<Id, Value>({
        effectActionType: 'setBranchEntries',
        path,
        entries: null,
      });

    case 'leaf':
      return undefined;
  }
}

/**
 * Handles normal-mode left interaction.
 *
 * Left from the root has no effect. Otherwise dispatch navigation to the
 * parent entry.
 */
function normalInteractLeftToEffect<Id extends SerializableKey, Value>(
  state: State<Id, Value>,
  cursorApi: CursorApi<Id>,
): Effect<Id, Value> | undefined {
  const path = cursorApi.getPath(state.cursor);

  if (path === undefined || path.length === 0) {
    return undefined;
  }

  return dispatchAction<Id, Value>({
    effectActionType: 'navigateToParent',
  });
}
