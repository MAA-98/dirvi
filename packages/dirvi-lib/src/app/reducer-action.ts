import type {
  Cursor,
  SerializableKey,
  State,
  TreeNode,
} from '../trees/index.js';

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
      kind: 'addToFoldTree';
      path: readonly Id[];
      cursor: Cursor<Id>;
      foldTreeIndex: number;
    }
  | {
      kind: 'removeFromFoldTree';
      path: readonly Id[];
      cursor: Cursor<Id>;
      foldTreeIndex: number;
    }
  | {
      /**
       * Activates a fold tree, making its hidden entries contribute to the
       * visible navigation projection.
       */
      kind: 'fold';
      foldTreeIndex: number;
    }
  | {
      /**
       * Deactivates a fold tree while preserving its fold definition.
       */
      kind: 'unfold';
      foldTreeIndex: number;
    }
  | {
      kind: 'createFoldTree';
      name: string;
    };
