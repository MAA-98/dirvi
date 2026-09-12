import type { Effect, EffectAction, Intent } from '../domain/index.js';
import {
  CursorApi,
  State,
  StateApi,
  TreeNode,
  TreeNodeApi,
} from '../../tree-surfer/index.js';

// Effect derived from intent and the state.
export type IntentToEffect<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = (
  intent: Intent,
  state: State<Name, BufferNode>,
) => Effect<Name, BufferNode> | undefined;

// Factory method, since Apis are needed to derive intent
export function createIntentToEffect<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  stateApi: StateApi<Name, BufferNode>,
  cursorApi: CursorApi<Name>,
  treeNodeApi: TreeNodeApi<Name, BufferNode>,
): IntentToEffect<Name, BufferNode> {
  return (intent, state) => {
    switch (intent.intentType) {
      case 'setNormalBuffer':
        return normalBufferToEffectResult<Name, BufferNode>(
          intent.normalBuffer,
        );

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
        return dispatchAction<Name, BufferNode>({
          effectActionType: 'nextEntry',
        });

      case 'normalUp':
        return dispatchAction<Name, BufferNode>({
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
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(action: EffectAction<Name, BufferNode>): Effect<Name, BufferNode> {
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
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(updatedNormalBuffer: string): Effect<Name, BufferNode> {
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
      return dispatchAction<Name, BufferNode>({
        effectActionType: 'toggleFold',
      });

    case 'zc':
      return dispatchAction<Name, BufferNode>({
        effectActionType: 'fold',
      });

    case 'zo':
      return dispatchAction<Name, BufferNode>({
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
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  state: State<Name, BufferNode>,
  stateApi: StateApi<Name, BufferNode>,
  cursorApi: CursorApi<Name>,
  treeNodeApi: TreeNodeApi<Name, BufferNode>,
): Effect<Name, BufferNode> | undefined {
  const currentEntry = stateApi.getNodeAtCursor(state);

  if (currentEntry === undefined) {
    return undefined;
  }

  const path = cursorApi.getPath(state.cursor);

  if (path === undefined) {
    return undefined;
  }

  if (treeNodeApi.isBranch(currentEntry)) {
    if (currentEntry.branches === null) {
      return {
        effectType: 'loadBranchEntries',
        path,
      };
    }

    return dispatchAction<Name, BufferNode>({
      effectActionType: 'setBranchEntries',
      path,
      entries: null,
    });
  }

  return {
    effectType: 'emitPath',
    path,
  };
}

function normalInteractLeftToEffect<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(state: State<Name, BufferNode>): Effect<Name, BufferNode> | undefined {
  if (state.cursor.parentPath.length === 0) {
    return undefined;
  }

  return dispatchAction<Name, BufferNode>({
    effectActionType: 'navigateToParent',
  });
}
