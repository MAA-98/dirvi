import type { SerializableKey, TreeNode, TreeNodeApi } from '../tree-node/index.js';
import type { Folds, FoldsApi } from '../fold-node/index.js';
import type { Cursor, CursorApi } from '../cursor.js';
import type {
  NavBranch,
  NavEntry,
  NavNode,
  NavNodeApi,
} from './nav-node.types.js';

export type NavEntryComparator<Id extends SerializableKey, Value> = (
  left: Readonly<{
    id: Id;
    value: Value;
  }>,
  right: Readonly<{
    id: Id;
    value: Value;
  }>,
) => number;

export type CreateNavNodeApiOptions<
  Id extends SerializableKey,
  Value,
> = Readonly<{
  /**
   * Defines display and cursor-navigation order among sibling entries.
   *
   * For deterministic navigation, this should define a total order for
   * distinct sibling entries. If two entries compare equal, their order falls
   * back to the source TreeNode child iteration order.
   */
  compareEntries: NavEntryComparator<Id, Value>;
}>;

/**
 * Creates operations for projecting an opaque tree into a navigation model.
 *
 * Navigation ordering is intentionally a UI concern. The underlying TreeNode
 * API need not promise a particular child-storage representation or ordering.
 */
export function createNavNodeApi<Id extends SerializableKey, Value>(
  treeNodeApi: TreeNodeApi<Id, Value>,
  foldsApi: FoldsApi<Id>,
  cursorApi: CursorApi<Id>,
  options: CreateNavNodeApiOptions<Id, Value>,
): NavNodeApi<Id, Value> {
  function entryIsBranch(entry: NavEntry<Id>): entry is NavBranch<Id> {
    return 'children' in entry;
  }

  function compareTreeNodes(
    left: TreeNode<Id, Value>,
    right: TreeNode<Id, Value>,
  ): number {
    return options.compareEntries(
      {
        id: treeNodeApi.id(left),
        value: treeNodeApi.value(left),
      },
      {
        id: treeNodeApi.id(right),
        value: treeNodeApi.value(right),
      },
    );
  }

  /**
   * Projects loaded children into navigation entries.
   *
   * Folded source entries are omitted from `entries` and represented in the
   * synthetic `folded` row instead.
   */
  function createNavNode(
    entries: Iterable<TreeNode<Id, Value>>,
    foldRoot: Folds<Id>,
    parentPath: readonly Id[],
  ): NavNode<Id> {
    const visibleEntries: NavEntry<Id>[] = [];
    const foldedEntries: NavEntry<Id>[] = [];

    /*
     * Navigation owns presentation order, so materialize and sort the child
     * iterable before projecting it.
     */
    const orderedEntries = [...entries].sort(compareTreeNodes);

    for (const entry of orderedEntries) {
      const entryId = treeNodeApi.id(entry);
      const entryPath = [...parentPath, entryId];
      
      const isFolded = foldsApi.isEntryHiddenAtPath(
        foldRoot,
        parentPath,
        entryId,
      );

      const navigationEntry = createNavEntry(entry, foldRoot, entryPath);

      if (isFolded) {
        foldedEntries.push(navigationEntry);
      } else {
        visibleEntries.push(navigationEntry);
      }
    }

    return {
      entries: visibleEntries,

      /*
       * Fold state may contain entries that are not currently available in the
       * loaded source tree. Do not render an empty synthetic row for them.
       */
      folded:
        foldedEntries.length === 0
          ? null
          : {
              entries: foldedEntries,
            },
    };
  }

  function createNavEntry(
    entry: TreeNode<Id, Value>,
    foldRoot: Folds<Id>,
    entryPath: readonly Id[],
  ): NavEntry<Id> {
    return treeNodeApi.match(entry, {
      leaf: ({ id }) => ({
        id,
      }),

      unloadedBranch: ({ id }) => ({
        id,
        children: null,
      }),

      loadedBranch: ({ id, children }) => ({
        id,
        children: createNavNode(children, foldRoot, entryPath),
      }),
    });
  }
  
  function createRootNavBranch(
    root: TreeNode<Id, Value>,
    foldRoot: Folds<Id>,
  ): NavBranch<Id> | undefined {
    return treeNodeApi.match<NavBranch<Id> | undefined>(root, {
      leaf: () => undefined,

      unloadedBranch: ({ id }) => ({
        id,
        children: null,
      }),

      loadedBranch: ({ id, children }) => ({
        id,
        children: createNavNode(children, foldRoot, []),
      }),
    });
  }

  function rootCursors(rootNode: NavBranch<Id>): Cursor<Id>[] {
    if (rootNode.children === null) {
      return [[]];
    }

    return [[], ...cursorsInNode(rootNode.children, [])];
  }

  function cursorsInNode(
    node: NavNode<Id>,
    parentPath: readonly Id[],
  ): Cursor<Id>[] {
    const cursors: Cursor<Id>[] = [];

    for (const entry of node.entries) {
      const entryPath = [...parentPath, entry.id];

      cursors.push(entryPath);

      if (!entryIsBranch(entry) || entry.children === null) {
        continue;
      }

      cursors.push(...cursorsInNode(entry.children, entryPath));
    }

    return cursors;
  }

  const navNodeApi: NavNodeApi<Id, Value> = {
    entryIsBranch,

    from(root, foldRoot) {
      return createRootNavBranch(root, foldRoot);
    },

    getNodeAtPath(
      navigation: NavNode<Id>,
      path: readonly Id[],
    ): NavNode<Id> | undefined {
      const [currentId, ...remainingPath] = path;

      /*
       * An empty path identifies the current navigation node.
       */
      if (currentId === undefined) {
        return navigation;
      }

      const entry = navigation.entries.find(
        (candidate) => candidate.id === currentId,
      );

      if (entry === undefined || !entryIsBranch(entry)) {
        return undefined;
      }

      /*
       * A null value represents a source branch whose children are not loaded.
       */
      if (entry.children === null) {
        return undefined;
      }

      return navNodeApi.getNodeAtPath(entry.children, remainingPath);
    },

    getEntryAtPath(
      navigation: NavNode<Id>,
      path: readonly Id[],
    ): NavEntry<Id> | undefined {
      const [currentId, ...remainingPath] = path;

      /*
       * A NavNode does not itself correspond to a NavEntry. Therefore [] does
       * not resolve to an entry.
       */
      if (currentId === undefined) {
        return undefined;
      }

      const entry = navigation.entries.find(
        (candidate) => candidate.id === currentId,
      );

      if (entry === undefined) {
        return undefined;
      }

      if (remainingPath.length === 0) {
        return entry;
      }

      if (!entryIsBranch(entry) || entry.children === null) {
        return undefined;
      }

      return navNodeApi.getEntryAtPath(entry.children, remainingPath);
    },

    nextCursor(
      rootNode: NavBranch<Id>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
      const cursors = rootCursors(rootNode);

      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex === -1 || currentIndex === cursors.length - 1) {
        return undefined;
      }

      return cursors[currentIndex + 1];
    },

    previousCursor(
      rootNode: NavBranch<Id>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
      const cursors = rootCursors(rootNode);

      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex <= 0) {
        return undefined;
      }

      return cursors[currentIndex - 1];
    },

    cursorAfterFold(
      rootNode: NavBranch<Id>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
      // Folding root disallowed
      if (cursor.length === 0) {
        return undefined;
      }

      const cursors = rootCursors(rootNode);

      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex === -1) {
        return undefined;
      }
      
      // If the last entry, then cursor should go to previous entry
      // This works to go to the root when the last entry in the root is folded.
      if (currentIndex + 1 === cursors.length) {
        return cursors[currentIndex - 1]
      }
      
      for (let index = currentIndex + 1; index < cursors.length; index += 1) {
        const candidate = cursors[index];

        if (candidate === undefined) {
          continue;
        }
        
        // Skip any entries that are children of the entry about to be folded
        if (cursorApi.cursorBelongsToSubtree(candidate, cursor)) {
          continue;
        }

        return candidate;
      }
    },

    parentCursor(_navigation, cursor) {
      if (cursor.length === 0) {
        return undefined;
      }

      return cursor.slice(0, -1);
    },

    cursors(navigation, parentPath = []) {
      return cursorsInNode(navigation, parentPath);
    },

    visibleLeavesPaths(
      navigation: NavNode<Id>,
      parentPath: readonly Id[] = [],
    ): Id[][] {
      const paths: Id[][] = [];

      for (const entry of navigation.entries) {
        const entryPath = [...parentPath, entry.id];

        if (!entryIsBranch(entry)) {
          paths.push(entryPath);
          continue;
        }

        /*
         * A null value means the source branch is not loaded/opened. It has no
         * currently visible descendants.
         */
        if (entry.children !== null) {
          paths.push(
            ...navNodeApi.visibleLeavesPaths(entry.children, entryPath),
          );
        }
      }

      return paths;
    },
  };

  return navNodeApi;
}
