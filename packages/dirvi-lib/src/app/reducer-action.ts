import type { Cursor, SerializableKey, State, TreeNode } from '../trees/index.js';

export type ReducerAction<Id extends SerializableKey, Value> =
  | {
      kind: 'changeCursor';
      cursor: Cursor<Id>;
    }
  | {
      kind: 'updateBranch';
      path: readonly Id[];
      entries: readonly TreeNode<Id, Value>[] | null; // null sets a branch as unloaded
    }
  | {
      kind: 'setState';
      oldState: State<Id, Value>; // For checking new state is latest
      newState: State<Id, Value>;
    }
  | {
      kind: 'fold';
      path: readonly Id[];
      cursor: Cursor<Id>;
    }
  | {
      kind: 'unfold';
      path: readonly Id[];
      cursor: Cursor<Id>;
    };
