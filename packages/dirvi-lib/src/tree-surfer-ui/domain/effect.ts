import type { InputState } from './input-state.js';
import type { TreeNode } from '../../tree-surfer/index.js';

// Still pure actions, but more semantic than ReducerActions.
export type Effect<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> =
  | {
      effectType: 'dispatchEffectAction';
      action: EffectAction<Name, BufferNode>;
    }
  | {
      effectType: 'loadBranchEntries';
      path: Name[];
    }
  | {
      effectType: 'emitPath';
      path: Name[];
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
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> =
  | {
      effectActionType: 'nextEntry';
    }
  | {
      effectActionType: 'prevEntry';
    }
  | {
      effectActionType: 'setBranchEntries';
      path: Name[];
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
