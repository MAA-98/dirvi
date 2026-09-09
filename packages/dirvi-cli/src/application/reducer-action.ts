import type { Cursor } from 'dirvi-lib';

export type ReducerAction<Name, BufferNode> =
  | {
      kind: 'changeCursor';
      cursor: Cursor<Name>;
    }
  | {
      kind: 'updateBranch';
      path: Name[];
      entries: BufferNode[] | null; // null for unloaded
    }
  | {
      kind: 'updateBuffer';
      oldEntries: BufferNode[];
      entries: BufferNode[];
    }
  | {
      kind: 'fold';
      parentPath: Name[];
      entry: BufferNode;
      cursor: Cursor<Name>;
    }
  | {
      kind: 'unfold';
      parentPath: Name[];
      cursor: Cursor<Name>;
    };
