import type {
  Cursor, FoldIndex,
  SerializableKey,
  State,
  TreeNode,
} from '../../state-and-nav/index.js';

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
      foldTreeIndex: FoldIndex;
    }
  | {
      kind: 'removeFromFoldTree';
      /** Parent branch containing the hidden entries. */
      path: readonly Id[];

      /**
       * null removes every direct hidden entry in this fold tree.
       * An array removes only the specified entries of an inline fold run.
       */
      entryIds: readonly Id[] | null;
      cursor: Cursor<Id>;
      foldTreeIndex: FoldIndex;
    }
  | {
      /**
       * Activates a fold tree, making its hidden entries contribute to the
       * visible navigation projection.
       */
      kind: 'fold';
      foldTreeIndex: FoldIndex;
    }
  | {
      /**
       * Deactivates a fold tree while preserving its fold definition.
       */
      kind: 'unfold';
      foldTreeIndex: FoldIndex;
    }
  | {
      /**
       * Inverts whether a fold tree contributes to hiding entries.
       */
      kind: 'toggleFold';
      foldTreeIndex: FoldIndex;
    }
  | {
      kind: 'createFoldTree';
      name: string;
    }
  | {
      kind: 'deleteFoldTree';
      name: string;
    };
