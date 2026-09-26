import {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from '../../tree-surfer/index.js';
import { Effect, EffectAction, Intent } from '../domain/index.js';
import { CursorApi, State, StateApi } from '../../tree-surfer/index.js';
import { parseCommand } from './parse-command.js';

/**
 * By design "effect = intent + state", so it awaits based on the intent and
 * the current state whether an effect should be executed.
 */
export type IntentToEffect<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = (
  intent: Intent,
  state: State<Id, Node>,
) => Effect<Id, Node> | undefined;

export function createIntentToEffect<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(
  stateApi: StateApi<Id, Node>,
  cursorApi: CursorApi<Id>,
  treeNodeApi: TreeNodeApi<Id, Node>,
): IntentToEffect<Id, Node> {
  
  return (intent, state) => {
    switch (intent.intentType) {
      case 'setNormalBuffer':
        return normalBufferToEffectResult<Id, Node>(intent.normalBuffer);

      case 'normalRight':
        return normalInteractRightToEffect(
          state,
          stateApi,
          cursorApi,
          treeNodeApi,
        );

      case 'normalLeft':
        return normalInteractLeftToEffect(state);

      case 'normalDown':
        return dispatchAction<Id, Node>({
          effectActionType: 'nextEntry',
        });

      case 'normalUp':
        return dispatchAction<Id, Node>({
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

function dispatchAction<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(action: EffectAction<Id, Node>): Effect<Id, Node> {
  return {
    effectType: 'dispatchEffectAction',
    action,
  };
}

// Sets the buffer. Three possibilities:
// - New command buffer is recognized as a motion, this dispatches the
// "effect action". Consumer will know to reset the input state.
// - Prefix of a possible motion, updates normal buffer.
// - Not a prefix, clears the buffer.
function normalBufferToEffectResult<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(updatedNormalBuffer: string): Effect<Id, Node> {
  switch (updatedNormalBuffer) {
    case 'z':
      return {
        effectType: 'setInputState',
        inputState: {
          inputMode: 'normal',
          normalBuffer: updatedNormalBuffer,
        },
      };

    case 'zc':
      return dispatchAction<Id, Node>({
        effectActionType: 'fold',
      });

    case 'zo':
      return dispatchAction<Id, Node>({
        effectActionType: 'unfold',
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

function normalInteractRightToEffect<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(
  state: State<Id, Node>,
  stateApi: StateApi<Id, Node>,
  cursorApi: CursorApi<Id>,
  treeNodeApi: TreeNodeApi<Id, Node>,
): Effect<Id, Node> | undefined {
  const currentEntry = stateApi.getNodeAtCursor(state);

  if (currentEntry === undefined) {
    return undefined;
  }

  const path = cursorApi.getPath(state.cursor);

  if (path === undefined) {
    return undefined;
  }

  if (treeNodeApi.isBranch(currentEntry)) {
    if (currentEntry.children === null) {
      return {
        effectType: 'loadBranchEntries',
        path,
      };
    }

    return dispatchAction<Id, Node>({
      effectActionType: 'setBranchEntries',
      path,
      entries: null,
    });
  }

  return;
}

function normalInteractLeftToEffect<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(state: State<Id, Node>): Effect<Id, Node> | undefined {
  if (state.cursor.length === 0) {
    return undefined;
  }

  return dispatchAction<Id, Node>({
    effectActionType: 'navigateToParent',
  });
}
