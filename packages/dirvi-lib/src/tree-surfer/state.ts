import { z } from 'zod';

import { Cursor, CursorApi, CursorKind } from './cursor.js';
import {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from './tree-node/tree-node.types.js';
import {
  FoldNode,
  FoldNodeApi,
  FoldNodeRoot,
} from './fold-node/fold-node.types.js';
import { NavNodeApi } from './nav-node/nav-node.types.js';

// Schema
export function createStateSchema<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  bufferNodeSchema: z.ZodType<BufferNode>,
  foldNodeRootSchema: z.ZodType<State<Id, BufferNode>['foldNode']>,
  cursorSchema: z.ZodType<State<Id, BufferNode>['cursor']>,
) {
  return z.object({
    buffer: z.array(bufferNodeSchema),
    foldNode: foldNodeRootSchema,
    cursor: cursorSchema,
  });
}

// Type
export type State<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = {
  buffer: BufferNode[];
  foldNode: FoldNodeRoot<Id>;
  cursor: Cursor<Id>;
};

export type StateApi<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = {
  getNodeAtCursor(state: State<Id, BufferNode>): BufferNode | undefined;

  /**
   * Reloads the root and all descendant branches that were loaded in the
   * previous state.
   */
  resync(
    oldState: State<Id, BufferNode>,
    loadBranches: (path: Id[]) => Promise<BufferNode[]>,
  ): Promise<State<Id, BufferNode>>;
};

export function createStateApi<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Id, BufferNode>,
  foldNodeApi: FoldNodeApi<Id>,
  cursorApi: CursorApi<Id>,
  navNodeApi: NavNodeApi<Id, BufferNode>,
): StateApi<Id, BufferNode> {
  // Helpers

  /**
   * Create a new buffer and fold node at this level.
   *
   * Works on fold root and child level through the generic.
   */
  async function reload<FoldType extends FoldNodeRoot<Id> | FoldNode<Id>>(
    oldBuffer: BufferNode[],
    oldFoldNode: FoldType | undefined, // Can be FoldNode too
    parentPath: Id[],
    loadBranches: (path: Id[]) => Promise<BufferNode[]>,
  ): Promise<{
    buffer: BufferNode[];
    foldNode: FoldType | undefined;
  }> {
    let newBufferAtRoot = await loadBranches(parentPath);
    let newFoldNode = oldFoldNode; // Start with assumption of no changes

    /**
     * Reload descendants that were already loaded in the old buffer.
     *
     * Fold membership is represented by IDs in `folds`, so it remains
     * valid across a reload without rebuilding an entry array.
     */
    for (const oldEntry of oldBuffer) {
      // If it wasn't an open branch, then there's no need to reload descendants.
      // Either the new entry is a leaf or an unopen branch.
      if (
        !treeNodeApi.isBranch(oldEntry) ||
        !treeNodeApi.isOpenBranch(oldEntry)
      ) {
        continue;
      }

      // Get the entry being updated, in the new buffer
      const newEntry = treeNodeApi.getAtPath(
        newBufferAtRoot,
        [oldEntry.id],
        (entry) => entry,
      );

      // If it doesn't exist (an open branch was deleted) then move on
      if (newEntry === undefined) {
        continue;
      }

      // The old entry may have changed into a leaf.
      // A newly loaded branch is normally closed here because loadBranches
      // returns flat entries, and the descendants are to be attached below.
      if (!treeNodeApi.isBranch(newEntry)) {
        continue;
      }

      const oldChildFoldNode =
        oldFoldNode === undefined
          ? undefined
          : foldNodeApi.getChildById(oldFoldNode, oldEntry.id);

      const entryPath = [...parentPath, oldEntry.id];

      const reloadedChild = await reload(
        [...treeNodeApi.getChildren(oldEntry)],
        oldChildFoldNode,
        entryPath,
        loadBranches,
      );

      const updatedBuffer = treeNodeApi.modifyAtPath(
        newBufferAtRoot,
        [oldEntry.id],
        (entry) => {
          // The entry may be closed: loadBranches normally returns branches
          // with `branches: null`. We are turning it back into an open branch.
          if (!treeNodeApi.isBranch(entry)) {
            return undefined;
          }

          return {
            ...entry,
            branches: reloadedChild.buffer,
          } as BufferNode;
        },
      );

      if (updatedBuffer !== undefined) {
        newBufferAtRoot = updatedBuffer;
      }
    }

    return {
      buffer: newBufferAtRoot,
      foldNode: newFoldNode,
    };
  }

  /**
   * Currently the cursor just goes to the first entry at root if
   * not all root entries are folded, otherwise the fold.
   *
   * TODO: Cursor policy:
   * 1. Keep the exact cursor if it survives,
   * 2. Otherwise, choose the deepest surviving ancestor entry,
   * 3. Otherwise, choose the nearest preceding old cursor that still survives,
   * 4. Otherwise, choose the first new cursor.
   * 5. If no cursor exists, use the root fold cursor.
   */
  function resyncCursor(
    oldState: State<Id, BufferNode>,
    newBuffer: BufferNode[],
    newFoldNode: FoldNodeRoot<Id>,
  ): Cursor<Id> | undefined {
    const navigation = navNodeApi.from(newBuffer, newFoldNode);

    return navNodeApi.cursors(navigation)[0];
  }

  return {
    getNodeAtCursor(state) {
      const path = cursorApi.getPath(state.cursor);

      if (path === undefined) {
        // The cursor is positioned on a fold rather than an entry.
        return undefined;
      }

      return treeNodeApi.getAtPath(state.buffer, path, (node) => node);
    },

    async resync(oldState, loadBranches) {
      const reloaded = await reload(
        oldState.buffer,
        oldState.foldNode,
        [],
        loadBranches,
      );

      /*
       * `oldState.foldNode` is always present. At the root reload starts with
       * that node, so `reloaded.foldNode` should also always be present.
       *
       * The fallback expresses the State invariant while satisfying the
       * optional return type needed by recursive child reloads.
       */
      const foldNode = reloaded.foldNode ?? oldState.foldNode;

      const cursor = resyncCursor(oldState, reloaded.buffer, foldNode) ?? {
        kind: CursorKind.Fold,
        parentPath: [],
      };

      return {
        ...oldState,
        buffer: reloaded.buffer,
        foldNode,
        cursor,
      };
    },
  };
}
