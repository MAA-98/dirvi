import type { SerializableKey, TreeNode } from '../tree-node/index.js';
import { Folds } from '../fold-node/index.js';

export type NavNode<Id extends SerializableKey> = {
  /**
   * Visible source entries and contiguous folds in sibling order.
   */
  entries: NavEntry<Id>[];
};

export type NavEntry<Id extends SerializableKey> =
  | NavLeaf<Id>
  | NavBranch<Id>
  | NavFoldEntry<Id>;

export type NavLeaf<Id extends SerializableKey> = {
  id: Id;
};

export type NavBranch<Id extends SerializableKey> = {
  id: Id;

  /**
   * `null` means this branch's children have not been loaded or opened.
   */
  children: NavNode<Id> | null;
};

export type NavFoldEntry<Id extends SerializableKey> = {
  folded: NavEntry<Id>[];
};

export type NavNodeApi<Id extends SerializableKey, Value> = {
  entryIsBranch(entry: NavEntry<Id>): entry is NavBranch<Id>;
  
  /**
   * Projects loaded source children in their existing sibling order.
   *
   * Each maximal contiguous run hidden by any enabled fold tree produces
   * one inline fold marker. Hidden descendants are not projected.
   *
   * Fold IDs absent from the loaded source tree produce no display items.
   *
   * Returns undefined when the source root is a leaf.
   * The root itself is never folded.
   */
  from(
    root: TreeNode<Id, Value>,
    folds: Folds<Id>,
  ): NavBranch<Id> | undefined;
};