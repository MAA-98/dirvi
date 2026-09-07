import { TreeNode, TreeNodeApi } from './tree-node.js';
import { FoldNode } from './fold-node.js';
import { Cursor, CursorApi } from './cursor.js';

export type State<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  buffer: BufferNode[];
  foldNode: FoldNode<Name>;
  cursor: Cursor<Name>;
};

export type StateApi<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  getNodeAtCursor(state: State<Name, BufferNode>): BufferNode | undefined;
};

export function createStateApi<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Name, BufferNode>,
  cursorApi: CursorApi<Name>,
): StateApi<Name, BufferNode> {
  return {
    getNodeAtCursor(state) {
      const path = cursorApi.getPath(state.cursor);

      if (path === undefined) {
        // The cursor is positioned on a fold rather than an entry.
        return undefined;
      }

      return treeNodeApi.getAtPath(state.buffer, path);
    },
  };
}
