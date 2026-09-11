import { nameSeqEqual, TreeNode, TreeNodeApi } from './tree-node.js';
import { FoldChild, FoldNodeApi } from './fold-node.js';
import { Cursor, CursorApi, CursorKind } from './cursor.js';
import { NavNodeApi } from './nav-node.js';

export type State<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  buffer: BufferNode[];
  foldNode: FoldChild<Name>;
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
  navNodeApi: NavNodeApi<Name, BufferNode>
): StateApi<Name, BufferNode> {
  async function reload(
    oldBuffer: BufferNode[],
    oldFoldNode: FoldChild<Name> | undefined,
    parentPath: Name[],
    loadBranches: LoadBranches<Name, BufferNode>,
  ): Promise<{
    buffer: BufferNode[];
    foldNode: FoldChild<Name> | undefined;
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
      const oldBranches = treeNodeApi.getChildren(oldEntry);

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
  
  function resyncCursor(
    oldState: State<Name, BufferNode>,
    newBuffer: BufferNode[],
    newFoldNode: FoldChild<Name>,
  ): Cursor<Name> | undefined {
    const oldNavigation = navNodeApi.from(oldState.buffer, oldState.foldNode);

    const newNavigation = navNodeApi.from(newBuffer, newFoldNode);

    const oldCursors = navNodeApi.cursors(oldNavigation);
    const newCursors = navNodeApi.cursors(newNavigation);

    if (newCursors.length === 0) {
      return undefined;
    }

    const oldCursorIndex = oldCursors.findIndex((candidate) =>
      cursorApi.equal(candidate, oldState.cursor),
    );

    // The original cursor still exists.
    if (oldCursorIndex !== -1) {
      return newCursors[Math.min(oldCursorIndex, newCursors.length - 1)];
    }
    
    const oldPath = cursorApi.getPath(oldState.cursor);

    return findFallbackForPath(
      oldPath ?? oldState.cursor.parentPath,
      newCursors,
    );
  }
  
  function findFallbackForPath(
    path: Name[],
    newCursors: Cursor<Name>[],
  ): Cursor<Name> | undefined {
    // First try the parent entry, then each ancestor entry.
    for (let length = path.length - 1; length > 0; length -= 1) {
      const ancestorPath = path.slice(0, length);

      const ancestorCursor = newCursors.find((candidate) =>
        cursorMatchesEntryPath(candidate, ancestorPath),
      );

      if (ancestorCursor !== undefined) {
        return ancestorCursor;
      }
    }

    // Try to remain in the same root entry, if it still exists.
    const rootName = path[0];

    if (rootName !== undefined) {
      const rootCursor = newCursors.find((candidate) => {
        const candidatePath = cursorApi.getPath(candidate);

        return (
          candidatePath !== undefined &&
          candidatePath.length > 0 &&
          treeNodeApi.nameEquals(candidatePath[0]!, rootName)
        );
      });

      if (rootCursor !== undefined) {
        return rootCursor;
      }
    }

    // Otherwise use the first available cursor.
    return newCursors[0];
  }
  
  function cursorMatchesEntryPath(cursor: Cursor<Name>, path: Name[]): boolean {
    if (!cursorApi.isEntry(cursor)) {
      return false;
    }

    const cursorPath = [...cursor.parentPath, cursor.entryName];

    return nameSeqEqual(cursorPath, path, treeNodeApi.nameEquals);
  }
  
  return {
    getNodeAtCursor(state) {
      if (state.cursor === undefined) {
        return undefined;
      }
      
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

      const foldNode = reloaded.foldNode ?? foldNodeApi.createEmpty();
      
      const cursor = resyncCursor(oldState, reloaded.buffer, foldNode) ?? {
        kind: CursorKind.Fold,
        parentPath: []
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
