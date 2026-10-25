import type { SerializableKey, TreeNode, TreeMethods } from '../tree/index.js';
import type { Folds, FoldMethods } from '../fold-node/index.js';
import type { CursorMethods } from '../cursor.js';
import type {
  NavBranch,
  NavEntry,
  NavFold,
  NavNode,
  NavMethods,
} from './nav.types.js';
import { createNavTraversalMethods } from './nav.traversal.js';

/**
 * Creates operations for projecting an opaque tree into a navigation model.
 *
 * Sibling order has no semantic meaning in this navigation system.
 * This projection preserves source sibling order among visible entries and
 * collects hidden entries into one leading, non-navigable fold summary.
 */
export function createUnorderedNavMethods<Id extends SerializableKey, Value>(
  treeMethods: TreeMethods<Id, Value>,
  foldMethods: FoldMethods<Id>,
  cursorMethods: CursorMethods<Id>,
): NavMethods<Id, Value> {
  /**
   * Projects loaded children into navigation entries.
   *
   * Folded source entries are collected into one leading, non-navigable
   * fold summary. Their complete projections are retained inside it.
   */
  function createNavNode(
    entries: Iterable<TreeNode<Id, Value>>,
    foldRoot: Folds<Id>,
    parentPath: readonly Id[],
  ): NavNode<Id> {
    const visibleEntries: NavEntry<Id>[] = [];
    const foldedEntries: NavEntry<Id>[] = [];

    for (const entry of entries) {
      const entryId = treeMethods.id(entry);
      const entryPath = [...parentPath, entryId];

      const isFolded = foldMethods.isEntryHiddenAtPath(
        foldRoot,
        parentPath,
        entryId,
      );

      const navigationEntry = createNavEntry(entry, foldRoot, entryPath);

      if (isFolded) {
        /*
         * Retain the complete projection for later fold inspection.
         * Ordinary traversal never descends into this hidden projection.
         */
        foldedEntries.push(navigationEntry);
      } else {
        visibleEntries.push(navigationEntry);
      }
    }

    return {
      /*
       * Fold state may contain entries that are not currently available in the
       * loaded source tree. Do not render an empty synthetic row for them.
       */
      entries:
        foldedEntries.length === 0
          ? visibleEntries
          : [{ folded: foldedEntries }, ...visibleEntries],
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
    ...createNavTraversalMethods<Id, Value>(cursorMethods, false),
    from: createRootNavBranch,
  };
}

type NavLeafOrBranch<Id extends SerializableKey> = Exclude<
  NavEntry<Id>,
  NavFold<Id>
>;
