import { nameSeqEqual, TreeNode, TreeNodeApi } from './tree-node.js';
import { FoldNode, FoldNodeApi, FoldNodeRoot } from './fold-node.js';
import { Cursor, CursorApi, CursorKind } from './cursor.js';
import { NavNodeApi } from './nav-node.js';

export type State<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  buffer: BufferNode[];
  foldNode: FoldNodeRoot<Name>;
  cursor: Cursor<Name>;
};

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
    loadBranches: (path: Name[]) => Promise<BufferNode[]>,
  ): Promise<State<Name, BufferNode>>;
};

export function createStateApi<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Name, BufferNode>,
  foldNodeApi: FoldNodeApi<Name>,
  cursorApi: CursorApi<Name>,
  navNodeApi: NavNodeApi<Name, BufferNode>
): StateApi<Name, BufferNode> {
  // Helpers
  
  /**
   * Create a new buffer and fold node at this level.
   *
   * Works on fold root and child level through the generic.
   */
  async function reload<FoldType extends FoldNodeRoot<Name> | FoldNode<Name>>(
    oldBuffer: BufferNode[],
    oldFoldNode: FoldType | undefined, // Can be FoldNode too
    parentPath: Name[],
    loadBranches: (path: Name[]) => Promise<BufferNode[]>,
  ): Promise<{
    buffer: BufferNode[];
    foldNode: FoldType | undefined;
  }> {
    let newBufferAtRoot = await loadBranches(parentPath);
    let newFoldNode = oldFoldNode; // Start with assumption of no changes

    /**
     * Reload descendants that were already loaded in the old buffer.
     *
     * Fold membership is represented by names in `folds`, so it remains
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
        [oldEntry.name],
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
          : foldNodeApi.getChildByName(oldFoldNode, oldEntry.name);

      const entryPath = [...parentPath, oldEntry.name];

      const reloadedChild = await reload(
        [...treeNodeApi.getChildren(oldEntry)],
        oldChildFoldNode,
        entryPath,
        loadBranches,
      );

      const updatedBuffer = treeNodeApi.modifyAtPath(
        newBufferAtRoot,
        [oldEntry.name],
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
   * Cursor policy:
   * 1. Keep the exact cursor if it survives,
   * 2. Otherwise, choose the deepest surviving ancestor entry,
   * 3. Otherwise, choose the nearest preceding old cursor that still survives,
   * 4. Otherwise, choose the first new cursor.
   * 5. If no cursor exists, use the root fold cursor.
   */
  function resyncCursor(
    oldState: State<Name, BufferNode>,
    newBuffer: BufferNode[],
    newFoldNode: FoldNodeRoot<Name>,
  ): Cursor<Name> | undefined {
    const oldNavigation = navNodeApi.from(oldState.buffer, oldState.foldNode);
    const newNavigation = navNodeApi.from(newBuffer, newFoldNode);

    const oldCursors = navNodeApi.cursors(oldNavigation);
    const newCursors = navNodeApi.cursors(newNavigation);

    if (newCursors.length === 0) {
      return undefined;
    }

    // 1. Retain the exact cursor when possible.
    const retainedCursor = newCursors.find((candidate) =>
      cursorApi.equal(candidate, oldState.cursor),
    );

    if (retainedCursor !== undefined) {
      return retainedCursor;
    }

    const oldPath =
      cursorApi.getPath(oldState.cursor) ?? oldState.cursor.parentPath;

    // 2. Prefer the deepest surviving ancestor entry.
    for (let length = oldPath.length - 1; length > 0; length -= 1) {
      const ancestorPath = oldPath.slice(0, length);

      const ancestorCursor = newCursors.find((candidate) =>
        cursorMatchesEntryPath(candidate, ancestorPath),
      );

      if (ancestorCursor !== undefined) {
        return ancestorCursor;
      }
    }

    // 3. If no ancestor remains, preserve visual position by finding the
    // nearest preceding old cursor that is still visible in the new navigation.
    const oldCursorIndex = oldCursors.findIndex((candidate) =>
      cursorApi.equal(candidate, oldState.cursor),
    );

    for (let index = oldCursorIndex - 1; index >= 0; index -= 1) {
      const oldCandidate = oldCursors[index]!;

      const survivingCandidate = newCursors.find((candidate) =>
        cursorApi.equal(candidate, oldCandidate),
      );

      if (survivingCandidate !== undefined) {
        return survivingCandidate;
      }
    }

    // 4. There is no meaningful predecessor.
    return newCursors[0];
  }
  
  function cursorMatchesEntryPath(
    cursor: Cursor<Name>,
    path: readonly Name[],
  ): boolean {
    const cursorPath = cursorApi.getPath(cursor);

    return (
      cursorPath !== undefined &&
      nameSeqEqual(cursorPath, path, treeNodeApi.nameEquals)
    );
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
      
      const cursor = resyncCursor(
        oldState,
        reloaded.buffer,
        foldNode,
      ) ?? {
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
