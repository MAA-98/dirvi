import type { InputState } from './input-state.js';
import { SerializableKey, TreeNode } from '../../tree-surfer/tree-node/tree-node.types.js';

// Still pure actions, but more semantic than ReducerActions.
export type Effect<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> =
  | {
      effectType: 'dispatchEffectAction';
      action: EffectAction<Id, BufferNode>;
    }
  | {
      effectType: 'loadBranchEntries';
      path: Id[];
    }
  | {
      effectType: 'emitPath';
      path: Id[];
    }
  | {
      effectType: 'quit';
      exitMessage: string;
    }
  | {
      effectType: 'setInputState';
      inputState: InputState;
    };

// Actions for reducer, still at effects-level though.
export type EffectAction<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> =
  | {
      effectActionType: 'nextEntry';
    }
  | {
      effectActionType: 'prevEntry';
    }
  | {
      effectActionType: 'setBranchEntries';
      path: Id[];
      entries: BufferNode[] | null;
    }
  | {
      effectActionType: 'navigateToParent';
    }
  | {
      effectActionType: 'fold';
    }
  | {
      effectActionType: 'unfold';
    }
  | {
      effectActionType: 'toggleFold';
    };
