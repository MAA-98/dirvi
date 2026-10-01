import type { SerializableKey, TreeNode } from '../tree-node/index.js';
import type { FoldsModel } from './fold-node.model.js';

/**
 * IDs of direct source-tree entries hidden at one source-tree branch.
 *
 * This is the value stored in each internal fold-tree node.
 */
type HiddenEntryIds<Id extends SerializableKey> = readonly Id[];

/**
 * Sparse fold-state projection of a source TreeNode tree.
 *
 * A fold-tree node corresponds to a branch in the source tree. Its value is
 * the IDs of direct source-tree entries hidden at that branch.
 *
 * This alias is intentionally not exported. Consumers may receive the tree
 * through FoldData, but only as an opaque TreeNode value.
 */
type FoldTree<Id extends SerializableKey> = TreeNode<Id, HiddenEntryIds<Id>>;

declare const foldsBrand: unique symbol;

/**
 * A slot index within Folds.
 *
 * Index 0 is always occupied by the required primary fold tree.
 *
 * Other valid indexes are non-negative safe integers. TypeScript cannot
 * represent that restriction for number, so indexes must be validated at
 * runtime at API boundaries.
 */
export type FoldIndex = number;

/**
 * Public user-facing metadata for a fold tree.
 *
 * Every fold tree has a name. `description: null` means that no description
 * has been supplied. An empty string is distinct: it is a supplied
 * description with no text.
 */
export type FoldInfo = Readonly<{
  /**
   * Durable user-facing name of the fold tree.
   */
  name: string;
  
  /**
   * User-facing description of the fold tree, or `null` when none exists.
   */
  description: string | null;
}>;

/**
 * Internal data stored in one occupied Folds slot.
 *
 * The slot index is intentionally not repeated here; it is the position of
 * this value in `FoldsData.slots`.
 */
type FoldSlot<Id extends SerializableKey> = Readonly<{
  name: string;
  description: string | null;
  tree: FoldTree<Id>;
}>;

/**
 * Fold-data slots.
 *
 * Slot zero is always occupied. Later slots may be unoccupied.
 */
type FoldSlots<Id extends SerializableKey> = readonly [
  FoldSlot<Id>,
  ...(FoldSlot<Id> | undefined)[],
];

/**
 * Private runtime representation of Folds.
 *
 * `slots[0]` is the required primary fold tree.
 *
 * For indexes greater than zero, `slots[index]` is either FoldData or
 * undefined when that slot is unoccupied.
 */
type FoldsData<Id extends SerializableKey> = Readonly<{
  slots: FoldSlots<Id>;
}>;

/**
 * Immutable collection of fold-data slots for one source node tree.
 *
 * Every contained fold tree uses the same ID paths as the source TreeNode
 * tree. Slot zero always contains a fold tree.
 */
export type Folds<Id extends SerializableKey> = {
  readonly [foldsBrand]: {
    readonly id: Id;
  };
};

function toData<Id extends SerializableKey>(folds: Folds<Id>): FoldsData<Id> {
  return folds as unknown as FoldsData<Id>;
}

function fromData<Id extends SerializableKey>(data: FoldsData<Id>): Folds<Id> {
  return data as unknown as Folds<Id>;
}

export type FoldsApi<Id extends SerializableKey> = Readonly<{
  /**
   * Creates Folds with its required primary fold tree in slot zero.
   *
   * The primary fold tree initially contains no hidden entries.
   */
  create(rootId: Id, initialPrimaryInfo: FoldInfo): Folds<Id>;

  /**
   * Returns metadata for the fold tree at an occupied slot.
   *
   * Index zero always returns FoldInfo for a valid Folds value.
   */
  getInfoAtIndex(folds: Folds<Id>, index: FoldIndex): FoldInfo | undefined;

  /**
   * Returns whether a slot is occupied.
   *
   * For valid Folds values, `hasAtIndex(folds, 0)` is always true.
   */
  hasAtIndex(folds: Folds<Id>, index: FoldIndex): boolean;

  /**
   * Returns occupied slot indexes.
   *
   * The ordering is ascending slot order.
   */
  indexes(folds: Folds<Id>): Iterable<FoldIndex>;

  /**
   * Stores an occupied fold slot at an index.
   *
   * Replaces any existing slot at that index. The supplied `Folds` value is not
   * mutated.
   *
   * This is a low-level operation. Most callers should use
   * `setAdditionalFoldAtIndex`, `updateInfoAtIndex`, or the fold-state
   * operations instead.
   */
  setAtIndex(
    folds: Folds<Id>,
    index: FoldIndex,
    foldData: FoldSlot<Id>,
  ): Folds<Id>;

  /**
   * Creates or replaces a non-primary fold tree at a slot.
   *
   * The new fold tree initially contains no hidden entries.
   *
   * This operation rejects index zero because the required primary fold tree
   * must not be replaced accidentally.
   */
  setAdditionalFoldAtIndex(
    folds: Folds<Id>,
    index: FoldIndex,
    rootId: Id,
    info: FoldInfo,
  ): Folds<Id> | undefined;

  /**
   * Removes a non-primary fold tree from a slot.
   *
   * Returns `undefined` when `index` is zero because the primary fold tree may
   * not be removed.
   *
   * Returns the original `Folds` reference when the non-primary slot is already
   * unoccupied.
   */
  removeAdditionalFoldAtIndex(
    folds: Folds<Id>,
    index: FoldIndex,
  ): Folds<Id> | undefined;

  /**
   * Replaces supplied user-facing metadata while preserving the fold tree.
   *
   * Omitted properties are left unchanged.
   *
   * - `description: string` sets or replaces the description.
   * - `description: null` clears the description.
   */
  updateInfoAtIndex(
    folds: Folds<Id>,
    index: FoldIndex,
    update: Readonly<{
      name?: string;
      description?: string | null;
    }>,
  ): Folds<Id> | undefined;

  /**
   * Returns whether an entry is hidden in the fold tree at one slot.
   *
   * `path` has the same meaning as a path in the source TreeNode tree.
   */
  isEntryHiddenAtPath(
    folds: Folds<Id>,
    index: FoldIndex,
    path: readonly Id[],
    entryId: Id,
  ): boolean;

  /**
   * Returns IDs hidden directly at a branch path in one fold tree.
   */
  hiddenEntryIdsAtPath(
    folds: Folds<Id>,
    index: FoldIndex,
    path: readonly Id[],
  ): Iterable<Id> | undefined;

  /**
   * Marks an entry as hidden at a branch path in one fold tree.
   */
  hideEntryAtPath(
    folds: Folds<Id>,
    index: FoldIndex,
    path: readonly Id[],
    entryId: Id,
  ): Folds<Id> | undefined;

  /**
   * Removes hidden state for an entry at a branch path in one fold tree.
   */
  showEntryAtPath(
    folds: Folds<Id>,
    index: FoldIndex,
    path: readonly Id[],
    entryId: Id,
  ): Folds<Id> | undefined;

  /**
   * Shows every entry hidden directly at the branch addressed by `path`.
   *
   * This removes all hidden-entry IDs at that fold-tree node but retains
   * descendant fold-tree nodes and their fold state.
   *
   * For example, given:
   *
   * root
   * └── src
   *     hiddenEntryIds: ["lib", "main.ts"]
   *     └── lib
   *         hiddenEntryIds: ["parser.ts"]
   *
   * showAllHiddenEntriesAtPath(folds, index, ["src"]) produces:
   *
   * root
   * └── src
   *     hiddenEntryIds: []
   *     └── lib
   *         hiddenEntryIds: ["parser.ts"]
   */
  showAllHiddenEntriesAtPath(
    folds: Folds<Id>,
    index: FoldIndex,
    path: readonly Id[],
  ): Folds<Id> | undefined;

  /**
   * Converts opaque runtime folds into a serializable fold-state model.
   */
  toModel(folds: Folds<Id>): FoldsModel<Id>;

  /**
   * Restores opaque runtime folds from a validated serialized model.
   *
   * This validates fold-internal invariants, but does not validate that paths
   * correspond to a specific source node tree.
   */
  fromModel(model: FoldsModel<Id>): Folds<Id> | undefined;
}>;