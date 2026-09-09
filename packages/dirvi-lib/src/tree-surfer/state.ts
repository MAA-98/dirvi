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
  cursorApi: CursorApi<Name>,
): StateApi<Name, BufferNode> {
  async function reloadLoadedDescendants(
    newEntriesWoLoadedBranches: BufferNode[],
    oldEntriesWSomeLoadedBranches: BufferNode[],
    parentPath: Name[],
    loadBranches: (path: Name[]) => Promise<BufferNode[]>,
  ): Promise<BufferNode[]> {
    let updatedEntries = newEntriesWoLoadedBranches;

    for (const oldEntry of oldEntriesWSomeLoadedBranches) {
      const oldBranches = treeNodeApi.getBranches(oldEntry);

      // Ignore leaves and branches that were not loaded before.
      if (oldBranches === undefined || oldBranches === null) {
        continue;
      }

      // Find the new entry with the same name as this entry
      const newEntry = updatedEntries.find((entry) =>
        treeNodeApi.nameEquals(entry.name, oldEntry.name),
      );

      // Skip if not a branch to add to
      if (newEntry === undefined || !treeNodeApi.isTreeNodeBranch(newEntry)) {
        continue;
      }

      const path = [...parentPath, oldEntry.name];
      // Load new entries at the branch
      const newBranches = await loadBranches(path);

      // Recursively reload descendants before replacing this entry's branches.
      const reloadedBranches = await reloadLoadedDescendants(
        newBranches,
        oldBranches,
        path,
        loadBranches,
      );

      const nextEntries = treeNodeApi.setBranchesAtPath(
        updatedEntries,
        [oldEntry.name],
        reloadedBranches,
      );

      if (nextEntries !== undefined) {
        updatedEntries = nextEntries;
      }
    }

    return updatedEntries;
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
      const rootEntries = await loadBranches([]);

      const buffer = await reloadLoadedDescendants(
        rootEntries,
        oldState.buffer,
        [],
        loadBranches,
      );

      return {
        ...oldState,
        buffer,
      };
    },
  };
}
