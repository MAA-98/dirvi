import type { SerializableKey } from '../tree-node/index.js';
import type { FoldSlotModel, FoldsModel } from './fold-node.model.js';

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

export type FoldsApi<Id extends SerializableKey> = Readonly<{
  /**
   * Creates Folds with its required primary fold tree in slot zero.
   *
   * The new fold tree initially contains no hidden entries and is active.
   */
  create(rootId: Id, initialPrimaryInfo: FoldInfo): Folds<Id>;

  /**
   * Returns the occupied slot index for a unique fold-tree name.
   *
   * Returns `undefined` when no occupied fold tree has the name, or when the
   * name is ambiguous. Fold-tree names should be kept unique so they remain
   * durable user-facing references.
   */
  getIndexByName(folds: Folds<Id>, name: string): FoldIndex | undefined;

  /**
   * Returns metadata for the fold tree at an occupied slot.
   *
   * Index zero always returns FoldInfo for a valid Folds value.
   */
  getInfoAtIndex(folds: Folds<Id>, index: FoldIndex): FoldInfo | undefined;

  /**
   * Returns whether the fold tree at an occupied slot is active.
   *
   * Returns `undefined` when the slot is unoccupied.
   */
  isActiveAtIndex(folds: Folds<Id>, index: FoldIndex): boolean | undefined;

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

  // TODO: Enforce unique names
  /**
   * Stores a serialized occupied fold slot at an index.
   *
   * Replaces any existing slot at that index. The supplied `Folds` value is not
   * mutated.
   *
   * `foldData` is converted into the internal opaque fold-tree representation.
   * This operation returns `undefined` when `index` is not a non-negative safe
   * integer or when the slot's fold-tree model cannot be restored.
   *
   * This is a low-level operation. Most callers should use
   * `setAdditionalFoldAtIndex`, `updateInfoAtIndex`, or the fold-state
   * operations instead.
   */
  setAtIndex(
    folds: Folds<Id>,
    index: FoldIndex,
    foldData: FoldSlotModel<Id>,
  ): Folds<Id> | undefined;

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
   * Marks the fold tree at an occupied slot as active.
   *
   * An active fold tree contributes to hiding entries.
   *
   * Returns `undefined` when the slot is unoccupied. Returns the original
   * Folds reference when the fold tree is already active.
   */
  activateAtIndex(folds: Folds<Id>, index: FoldIndex): Folds<Id> | undefined;

  /**
   * Marks the fold tree at an occupied slot as inactive.
   *
   * An inactive fold tree retains its definition but does not contribute to
   * hiding entries.
   *
   * Returns `undefined` when the slot is unoccupied. Returns the original
   * Folds reference when the fold tree is already inactive.
   */
  deactivateAtIndex(folds: Folds<Id>, index: FoldIndex): Folds<Id> | undefined;

  /**
   * Inverts whether the fold tree at an occupied slot is active.
   *
   * Returns `undefined` when the slot is unoccupied.
   */
  toggleActiveAtIndex(
    folds: Folds<Id>,
    index: FoldIndex,
  ): Folds<Id> | undefined;

  /**
   * Returns whether an entry is hidden by one fold tree at an occupied slot.
   *
   * This checks the fold definition regardless of whether that fold tree is
   * currently active.
   */
  isEntryHiddenInFoldAtPath(
    folds: Folds<Id>,
    index: FoldIndex,
    path: readonly Id[],
    entryId: Id,
  ): boolean;

  /**
   * Returns whether an entry is hidden by at least one active fold tree.
   *
   * Inactive fold trees retain fold definitions but do not contribute to this
   * result.
   */
  isEntryHiddenAtPath(
    folds: Folds<Id>,
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
