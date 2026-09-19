import { SerializableKey, TreeNode, TreeNodeApi } from '../tree-node/tree-node.types.js';
import { FoldNode, FoldNodeApi, FoldNodeRoot } from '../fold-node/fold-node.types.js';
import { Cursor, CursorApi, CursorKind } from '../cursor.js';
import { NavNodeApi } from '../nav-node/nav-node.types.js';
import { StateApi, State } from './state.types.js';

export function createStateApi<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(
  treeNodeApi: TreeNodeApi<Id, Node>,
  foldNodeApi: FoldNodeApi<Id>,
  cursorApi: CursorApi<Id>,
  navNodeApi: NavNodeApi<Id, Node>,
): StateApi<Id, Node> {
  /**
   * Create a new buffer and fold node at a level.
   *
   * Works on fold root and descendant fold nodes using the generic.
   */
  async function reload<FoldType extends FoldNodeRoot<Id> | FoldNode<Id>>(
    oldBuffer: Node[],
    oldFoldNode: FoldType | undefined,
    parentPath: Id[],
    loadBranches: (path: Id[]) => Promise<Node[]>,
  ): Promise<{
    buffer: Node[];
    foldNode: FoldType | undefined;
  }> {
    let newBuffer = await loadBranches(parentPath);
    let newFoldNode = oldFoldNode; // Start with assumption of no changes

    for (const oldEntry of oldBuffer) {
      if (
        !treeNodeApi.isBranch(oldEntry) ||
        !treeNodeApi.isOpenBranch(oldEntry)
      ) {
        continue;
      }

      const newEntry = treeNodeApi.getAtPath(
        newBuffer,
        [oldEntry.id],
        (entry) => entry,
      );

      if (newEntry === undefined || !treeNodeApi.isBranch(newEntry)) {
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
        newBuffer,
        [oldEntry.id],
        (entry) => {
          // The entry may be closed: loadBranches normally returns branches
          // with `branches: null`. We are turning it back into an open branch.
          if (!treeNodeApi.isBranch(entry)) {
            return undefined;
          }

          return {
            ...entry,
            children: reloadedChild.buffer,
          } as Node;
        },
      );

      if (updatedBuffer !== undefined) {
        newBuffer = updatedBuffer;
      }
    }

    return {
      buffer: newBuffer,
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
    oldState: State<Id, Node>,
    newBuffer: Node[],
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

    async resync(oldState, loadChildren) {
      const reloaded = await reload(
        oldState.buffer,
        oldState.foldNode,
        [],
        loadChildren,
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
