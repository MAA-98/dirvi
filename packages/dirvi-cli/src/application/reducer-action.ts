import type { Cursor, SerializableKey, State, TreeNode } from 'dirvi-lib';

export type ReducerAction<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> =
  | {
      kind: 'changeCursor';
      cursor: Cursor<Id>;
    }
  | {
      kind: 'updateBranch';
      path: Id[];
      entries: BufferNode[] | null; // null for unloaded
    }
  | {
      kind: 'setState';
      oldState: State<Id, BufferNode>; // For checking new entry is new
      newState: State<Id, BufferNode>;
    }
  | {
      kind: 'fold';
      parentPath: Id[];
      entry: BufferNode;
      cursor: Cursor<Id>;
    }
  | {
      kind: 'unfold';
      parentPath: Id[];
      cursor: Cursor<Id>;
    };
