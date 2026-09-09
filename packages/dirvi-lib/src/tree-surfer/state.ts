import { TreeNode, TreeNodeApi } from './tree-node.js';
import { FoldNode, FoldNodeApi } from './fold-node.js';
import { Cursor, CursorApi } from './cursor.js';

export type State<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  buffer: BufferNode[];
  foldNode: FoldNode<Name>;
  cursor: Cursor<Name>;
};

export type LoadBranches<Name, BufferNode> = (
  path: Name[],
) => Promise<BufferNode[]>;

export type StateApi<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  getNodeAtCursor(state: State<Name, BufferNode>): BufferNode | undefined;

  /**
   * Reloads the root and all descendant branches that were loaded in the
   * previous state.
   */
  resync(
    oldState: State<Name, BufferNode>,
    loadBranches: LoadBranches<Name, BufferNode>,
  ): Promise<State<Name, BufferNode>>;
};

export function createStateApi<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Name, BufferNode>,
  foldNodeApi: FoldNodeApi<Name, BufferNode>,
  cursorApi: CursorApi<Name>,
): StateApi<Name, BufferNode> {
  async function reload(
    oldBuffer: BufferNode[],
    oldFoldNode: FoldNode<Name> | undefined,
    parentPath: Name[],
    loadBranches: LoadBranches<Name, BufferNode>,
  ): Promise<{
    buffer: BufferNode[];
    foldNode: FoldNode<Name> | undefined;
  }> {
    // Build the new entries at this level.
    let newBuffer = await loadBranches(parentPath);

    // Build the fold node for this level from the old fold node.
    let newFoldNode = oldFoldNode;

    if (newFoldNode !== undefined) {
      const foldedEntries = newBuffer.filter((entry) =>
        newFoldNode?.folds.some((foldedName) =>
          treeNodeApi.nameEquals(entry.name, foldedName),
        ),
      );

      newFoldNode = foldNodeApi.setFoldedEntries(newFoldNode, foldedEntries);
    }

    // Reload descendants that were already loaded in the old buffer.
    for (const oldEntry of oldBuffer) {
      const oldBranches = treeNodeApi.getBranches(oldEntry);

      if (oldBranches === undefined || oldBranches === null) {
        continue;
      }

      const newEntry = newBuffer.find((entry) =>
        treeNodeApi.nameEquals(entry.name, oldEntry.name),
      );

      if (newEntry === undefined || !treeNodeApi.isTreeNodeBranch(newEntry)) {
        continue;
      }

      const entryPath = [...parentPath, oldEntry.name];

      const oldChildFoldNode =
        newFoldNode === undefined
          ? undefined
          : foldNodeApi.getAtPath(newFoldNode, [oldEntry.name]);

      const reloadedChild = await reload(
        oldBranches,
        oldChildFoldNode,
        entryPath,
        loadBranches,
      );

      const updatedBuffer = treeNodeApi.setBranchesAtPath(
        newBuffer,
        [oldEntry.name],
        reloadedChild.buffer,
      );

      if (updatedBuffer !== undefined) {
        newBuffer = updatedBuffer;
      }

      if (newFoldNode !== undefined && reloadedChild.foldNode !== undefined) {
        newFoldNode = foldNodeApi.modifyAtPath(
          newFoldNode,
          [oldEntry.name],
          () => reloadedChild.foldNode!,
        );
      }
    }

    return {
      buffer: newBuffer,
      foldNode: newFoldNode,
    };
  }

  return {
    getNodeAtCursor(state) {
      const path = cursorApi.getPath(state.cursor);

      if (path === undefined) {
        // The cursor is positioned on a fold rather than an entry.
        return undefined;
      }

      return treeNodeApi.getAtPath(state.buffer, path);
    },

    async resync(oldState, loadBranches) {
      const reloaded = await reload(
        oldState.buffer,
        oldState.foldNode,
        [],
        loadBranches,
      );

      return {
        ...oldState,
        buffer: reloaded.buffer,
        foldNode: reloaded.foldNode ?? foldNodeApi.createEmpty(),
      };
    },
  };
}
