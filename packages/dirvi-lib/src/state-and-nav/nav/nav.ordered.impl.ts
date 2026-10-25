import type { SerializableKey, TreeNode, TreeMethods } from '../tree/index.js';
import type { Folds, FoldMethods } from '../fold-node/index.js';
import type { CursorMethods } from '../cursor.js';
import type {
  NavBranch,
  NavEntry,
  NavFold,
  NavMethods,
  NavNode,
} from './nav.types.js';
import { createNavTraversalMethods } from './nav.traversal.js';

/**
 * Creates an ordered navigation projection.
 *
 * Source sibling order is preserved. Each maximal contiguous run of hidden
 * direct children becomes one inline fold marker.
 */
export function createOrderedNavMethods<Id extends SerializableKey, Value>(
  treeMethods: TreeMethods<Id, Value>,
  foldMethods: FoldMethods<Id>,
  cursorMethods: CursorMethods<Id>,
): NavMethods<Id, Value> {
  /**
   * Projects loaded direct children without changing their source order.
   */
  function createNavNode(
    entries: Iterable<TreeNode<Id, Value>>,
    foldRoot: Folds<Id>,
    parentPath: readonly Id[],
  ): NavNode<Id> {
    const visibleEntries: NavEntry<Id>[] = [];
    let foldedEntries: NavFold<Id> | undefined;

    for (const entry of entries) {
      const entryId = treeMethods.id(entry);
      const entryPath = [...parentPath, entryId];
      const navigationEntry = createNavEntry(entry, foldRoot, entryPath);

      const isFolded = foldMethods.isEntryHiddenAtPath(
        foldRoot,
        parentPath,
        entryId,
      );

      if (isFolded) {
        /*
         * Append a marker when a hidden run begins. Subsequent hidden
         * siblings extend that same marker until a visible sibling ends it.
         */
        if (foldedEntries === undefined) {
          foldedEntries = {
            folded: [],
          };

          visibleEntries.push(foldedEntries);
        }

        /*
         * Retain the complete projection for later fold inspection.
         * Ordinary traversal never descends into this hidden projection.
         */
        foldedEntries.folded.push(navigationEntry);

        continue;
      }

      foldedEntries = undefined;
      visibleEntries.push(navigationEntry);
    }

    return {
      entries: visibleEntries,
    };
  }

  function createNavEntry(
    entry: TreeNode<Id, Value>,
    foldRoot: Folds<Id>,
    entryPath: readonly Id[],
  ): NavLeafOrBranch<Id> {
    return treeMethods.matchByKind<NavLeafOrBranch<Id>>(entry, {
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
    return treeMethods.matchByKind<NavBranch<Id> | undefined>(root, {
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

  return {
    ...createNavTraversalMethods<Id, Value>(cursorMethods, true),
    from: createRootNavBranch,
  };
}

type NavLeafOrBranch<Id extends SerializableKey> = Exclude<
  NavEntry<Id>,
  NavFold<Id>
>;
