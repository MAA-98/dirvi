import {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from '../../tree-surfer/tree-node/tree-node.types.js';
import { Effect, EffectAction, Intent } from '../domain/index.js';
import { CursorApi, State, StateApi } from '../../tree-surfer/index.js';

// Effect derived from intent and the state.
export type IntentToEffect<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = (
  intent: Intent,
  state: State<Id, BufferNode>,
) => Effect<Id, BufferNode> | undefined;

// Factory method, since Apis are needed to derive intent
export function createIntentToEffect<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  stateApi: StateApi<Id, BufferNode>,
  cursorApi: CursorApi<Id>,
  treeNodeApi: TreeNodeApi<Id, BufferNode>,
): IntentToEffect<Id, BufferNode> {
  return (intent, state) => {
    switch (intent.intentType) {
      case 'setNormalBuffer':
        return normalBufferToEffectResult<Id, BufferNode>(intent.normalBuffer);

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
        return dispatchAction<Id, BufferNode>({
          effectActionType: 'nextEntry',
        });

      case 'normalUp':
        return dispatchAction<Id, BufferNode>({
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
        if (intent.commandLine === ':q') {
          return {
            effectType: 'quit',
            exitMessage: '',
          };
        }
        
        if (intent.commandLine === ':evlp') {
          return {
            effectType: 'emitVisibleLeavesPaths',
          };
        }

        return {
          effectType: 'setInputState',
          inputState: {
            inputMode: 'normal',
            normalBuffer: '',
          },
        };
    }
  };
}

function dispatchAction<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(action: EffectAction<Id, BufferNode>): Effect<Id, BufferNode> {
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
  BufferNode extends TreeNode<Id, BufferNode>,
>(updatedNormalBuffer: string): Effect<Id, BufferNode> {
  switch (updatedNormalBuffer) {
    case 'z':
      return {
        effectType: 'setInputState',
        inputState: {
          inputMode: 'normal',
          normalBuffer: updatedNormalBuffer,
        },
      };

    case 'za':
      return dispatchAction<Id, BufferNode>({
        effectActionType: 'toggleFold',
      });

    case 'zc':
      return dispatchAction<Id, BufferNode>({
        effectActionType: 'fold',
      });

    case 'zo':
      return dispatchAction<Id, BufferNode>({
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
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  state: State<Id, BufferNode>,
  stateApi: StateApi<Id, BufferNode>,
  cursorApi: CursorApi<Id>,
  treeNodeApi: TreeNodeApi<Id, BufferNode>,
): Effect<Id, BufferNode> | undefined {
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

    return dispatchAction<Id, BufferNode>({
      effectActionType: 'setBranchEntries',
      path,
      entries: null,
    });
  }

  return;
}

function normalInteractLeftToEffect<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(state: State<Id, BufferNode>): Effect<Id, BufferNode> | undefined {
  if (state.cursor.parentPath.length === 0) {
    return undefined;
  }

  return dispatchAction<Id, BufferNode>({
    effectActionType: 'navigateToParent',
  });
}
