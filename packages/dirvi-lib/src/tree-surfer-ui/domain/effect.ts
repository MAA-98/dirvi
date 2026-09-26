import type { InputModeState } from './input-mode-state.js';
import { SerializableKey, TreeNode } from '../../tree-surfer/index.js';

export type Effect<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> =
  | {
      effectType: 'dispatchEffectAction';
      action: EffectAction<Id, Node>;
    }
  | {
      effectType: 'loadBranchEntries';
      path: Id[];
    }
  | {
      effectType: 'peekFold';
      parentPath: readonly Id[];
    }
  | {
      effectType: 'saveView';
      name: string;
      overwrite: boolean;
    }
  | {
      effectType: 'loadView';
      name: string;
    }
  | {
      effectType: 'emitVisibleLeavesPaths';
    }
  | {
      effectType: 'quit';
      exitMessage: string;
    }
  | {
      effectType: 'setInputState';
      inputState: InputModeState;
    };

// Actions for reducer to change state.
export type EffectAction<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
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
      entries: Node[] | null;
    }
  | {
      effectActionType: 'navigateToParent';
    }
  | {
      effectActionType: 'fold';
    }
  | {
      effectActionType: 'unfold';
    };
