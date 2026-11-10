import type { Cursor, CursorMethods, FoldCursor } from '../cursor.js';
import type { SerializableKey } from 'dirvi-apis';
import type {
  NavBranch,
  NavEntry,
  NavFold,
  NavMethods,
  NavNode,
} from './nav.types.js';

/**
 * Shared navigation operations over both projection styles.
 *
 * Fold summaries exist in either projection, but only ordered navigation
 * exposes them as cursor destinations.
 */
export function createNavTraversalMethods<Id, Value>(
  cursorMethods: CursorMethods<Id>,
  navigateFolds: boolean,
): Omit<NavMethods<Id, Value>, 'from' | 'foldedCountIfUnordered'> {
  function entryIsBranch(
    entry: NavEntry<Id, Value>,
  ): entry is NavBranch<Id, Value> {
    return 'children' in entry;
  }

  function entryIsFold(
    entry: NavEntry<Id, Value>,
  ): entry is NavFold<Id, Value> {
    return 'folded' in entry;
  }

  function foldCursor(
    entry: NavFold<Id, Value>,
    parentPath: readonly Id[],
  ): FoldCursor<Id> | undefined {
    const firstEntry = entry.folded[0];

    /*
     * Projected folds are nonempty and contain direct source entries.
     * Keep the guard because NavFold also permits richer future contents.
     */
    if (firstEntry === undefined || entryIsFold(firstEntry)) {
      return undefined;
    }

    return {
      parentPath: [...parentPath],
      firstId: firstEntry.id,
    };
  }

  function getNodeAtPath(
    navigation: NavNode<Id, Value>,
    path: readonly Id[],
  ): NavNode<Id, Value> | undefined {
    let node = navigation;

    for (const id of path) {
      const entry = node.entries.find(
        (candidate) => !entryIsFold(candidate) && candidate.id === id,
      );

      /*
       * Paths cannot pass through leaves, folds, or unloaded branches.
       * Hidden entries inside fold summaries are deliberately not searched.
       */
      if (
        entry === undefined ||
        !entryIsBranch(entry) ||
        entry.children === null
      ) {
        return undefined;
      }

      node = entry.children;
    }

    // An empty path identifies the current navigation node.
    return node;
  }

  function getEntryAtPath(
    navigation: NavNode<Id, Value>,
    path: readonly Id[],
  ): NavEntry<Id, Value> | undefined {
    /*
     * A NavNode does not itself correspond to a NavEntry. Therefore [] does
     * not resolve to an entry.
     */
    if (path.length === 0) {
      return undefined;
    }

    const parent = getNodeAtPath(navigation, path.slice(0, -1));
    const id = path[path.length - 1];

    return parent?.entries.find(
      (candidate) => !entryIsFold(candidate) && candidate.id === id,
    );
  }

  function cursors(
    navigation: NavNode<Id, Value>,
    parentPath: readonly Id[] = [],
  ): Cursor<Id>[] {
    const positions: Cursor<Id>[] = [];

    for (const entry of navigation.entries) {
      if (entryIsFold(entry)) {
        if (navigateFolds) {
          const cursor = foldCursor(entry, parentPath);

          if (cursor !== undefined) {
            positions.push(cursor);
          }
        }

        // Hidden descendants are never separately navigable.
        continue;
      }

      const entryPath = [...parentPath, entry.id];

      positions.push({ path: entryPath });

      if (entryIsBranch(entry) && entry.children !== null) {
        positions.push(...cursors(entry.children, entryPath));
      }
    }

    return positions;
  }

  function rootCursors(rootNode: NavBranch<Id, Value>): Cursor<Id>[] {
    return [
      { path: [] },
      ...(rootNode.children === null ? [] : cursors(rootNode.children)),
    ];
  }

  function nextCursor(
    rootNode: NavBranch<Id, Value>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined {
    const positions = rootCursors(rootNode);
    const currentIndex = positions.findIndex((candidate) =>
      cursorMethods.equal(candidate, cursor),
    );

    if (currentIndex === -1) {
      return undefined;
    }

    return positions[currentIndex + 1];
  }

  function previousCursor(
    rootNode: NavBranch<Id, Value>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined {
    const positions = rootCursors(rootNode);
    const currentIndex = positions.findIndex((candidate) =>
      cursorMethods.equal(candidate, cursor),
    );

    if (currentIndex <= 0) {
      return undefined;
    }

    return positions[currentIndex - 1];
  }

  function cursorAfterFold(
    rootNode: NavBranch<Id, Value>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined {
    if (
      !cursorMethods.isNodeCursor(cursor) ||
      cursor.path.length === 0 ||
      rootNode.children === null
    ) {
      // Folding root is disallowed. Fold markers are already folded.
      return undefined;
    }

    if (navigateFolds) {
      const parentPath = cursor.path.slice(0, -1);
      const parent = getNodeAtPath(rootNode.children, parentPath);
      const id = cursor.path[cursor.path.length - 1];

      if (parent === undefined) {
        return undefined;
      }

      const currentIndex = parent.entries.findIndex(
        (entry) => !entryIsFold(entry) && entry.id === id,
      );

      if (currentIndex === -1) {
        return undefined;
      }

      const entry = parent.entries[currentIndex];

      if (entry === undefined || entryIsFold(entry)) {
        return undefined;
      }

      const previousEntry = parent.entries[currentIndex - 1];

      /*
       * Folding next to an existing preceding run merges into that run.
       * A following run also merges, but does not determine the first ID.
       */
      if (previousEntry !== undefined && entryIsFold(previousEntry)) {
        const previousFoldCursor = foldCursor(previousEntry, parentPath);

        if (previousFoldCursor !== undefined) {
          return previousFoldCursor;
        }
      }

      return {
        parentPath,
        firstId: entry.id,
      };
    }

    const positions = rootCursors(rootNode);
    const currentIndex = positions.findIndex((candidate) =>
      cursorMethods.equal(candidate, cursor),
    );

    if (currentIndex === -1) {
      return undefined;
    }

    for (let index = currentIndex + 1; index < positions.length; index += 1) {
      const candidate = positions[index];

      if (candidate === undefined) {
        continue;
      }

      // Skip entries that are children of the entry about to be folded.
      if (cursorMethods.cursorBelongsToSubtree(candidate, cursor.path)) {
        continue;
      }

      return candidate;
    }

    /*
     * No following position survives the fold. Move before the subtree,
     * rather than into one of its soon-to-be-hidden descendants.
     */
    return positions[currentIndex - 1];
  }

  function parentCursor(
    _navigation: NavNode<Id, Value>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined {
    if (cursorMethods.isFoldCursor(cursor)) {
      return {
        path: [...cursor.parentPath],
      };
    }

    if (cursor.path.length === 0) {
      return undefined;
    }

    return {
      path: cursor.path.slice(0, -1),
    };
  }

  function visiblePaths(
    navigation: NavNode<Id, Value>,
    parentPath: readonly Id[] = [],
  ): Id[][] {
    const paths: Id[][] = [];

    for (const entry of navigation.entries) {
      if (entryIsFold(entry)) {
        continue;
      }

      const entryPath = [...parentPath, entry.id];
      paths.push(entryPath);

      /*
       * A null value means the source branch is not loaded/opened. It has no
       * currently visible descendants.
       */
      if (entryIsBranch(entry) && entry.children !== null) {
        paths.push(...visiblePaths(entry.children, entryPath));
      }
    }

    return paths;
  }

  return {
    entryIsBranch,
    entryIsFold,
    getNodeAtPath,
    getEntryAtPath,
    nextCursor,
    previousCursor,
    cursorAfterFold,
    parentCursor,
    cursors,
    visiblePaths,
  };
}
