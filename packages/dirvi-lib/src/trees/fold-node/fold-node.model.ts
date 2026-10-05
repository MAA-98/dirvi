import { z } from 'zod';

import type { SerializableKey } from '../tree-node/index.js';

/**
 * Returns whether every value appears at most once.
 *
 * `SerializableKey` values are strings or numbers, so `Set` equality is the
 * appropriate equality relation for fold-node IDs.
 */
function hasUniqueValues<Value>(values: readonly Value[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Serializable semantic representation of one fold-state tree node.
 *
 * This is a persistence/interchange model. It is not the runtime
 * representation of the fold tree.
 *
 * A fold node represents one source-tree node. Its `hiddenEntryIds` are IDs of
 * direct source-tree entries hidden at that node. Its `children` are sparse
 * fold-state descendants.
 *
 * `children` does not contain every source-tree child. It contains only
 * children which have fold state at or below them.
 *
 * A child fold-node ID is allowed to also appear in `hiddenEntryIds`. For
 * example:
 *
 * ```text
 * root
 *   hiddenEntryIds: ["src"]
 *   children:
 *     - id: "src"
 *       hiddenEntryIds: ["lib"]
 * ```
 *
 * This means `src` is hidden directly under `root`, while fold state below
 * `src` is retained for when it is shown again.
 */
export type FoldNodeModel<Id extends SerializableKey> = Readonly<{
  /**
   * The source-tree node ID represented by this fold-state node.
   */
  id: Id;

  /**
   * IDs of direct source-tree entries hidden at this node.
   *
   * These IDs are semantically a set: duplicates are invalid and iteration
   * order has no meaning.
   */
  hiddenEntryIds: readonly Id[];

  /**
   * Sparse child fold-state nodes.
   *
   * This is semantically keyed by child ID. Array order has no meaning.
   */
  children: readonly FoldNodeModel<Id>[];
}>;

/**
 * Creates a schema for one serialized fold-state tree.
 *
 * The schema validates fold-tree-local invariants only:
 *
 * - every hidden entry ID is unique within its fold node;
 * - every child fold-node ID is unique within its parent.
 *
 * It intentionally does not validate:
 *
 * - that an ID exists in a particular source tree;
 * - that a child fold node corresponds to a direct source-tree child;
 * - whether the represented source-tree node is a branch;
 * - whether an entry is currently loaded in the source tree.
 *
 * Those rules require access to the source tree and belong in a fold service,
 * not in this serialization schema.
 */
export function createFoldNodeModelSchema<Id extends SerializableKey>(
  idSchema: z.ZodType<Id>,
): z.ZodType<FoldNodeModel<Id>> {
  let nodeSchema: z.ZodType<FoldNodeModel<Id>>;

  const hiddenEntryIdsSchema = z.array(idSchema).refine(hasUniqueValues, {
    message: 'Hidden entry IDs must be unique within a fold node',
    path: ['hiddenEntryIds'],
  });

  nodeSchema = z.lazy(() =>
    z
      .object({
        id: idSchema,
        hiddenEntryIds: hiddenEntryIdsSchema,
        children: z.array(nodeSchema),
      })
      .strict()
      .refine(
        (node) => hasUniqueValues(node.children.map((child) => child.id)),
        {
          message: 'Child fold-node IDs must be unique within a fold node',
          path: ['children'],
        },
      ),
  );

  return nodeSchema;
}

/**
 * Serializable metadata and fold-state tree for one occupied fold slot.
 *
 * `description: null` means that this fold tree has no description.
 * An empty string is a supplied description with no text.
 */
export type FoldSlotModel<Id extends SerializableKey> = Readonly<{
  /**
   * User-facing name of this fold tree.
   */
  name: string;

  /**
   * User-facing description of this fold tree, or `null` when it has none.
   */
  description: string | null;

  /**
   * Whether this fold tree currently contributes to hiding entries.
   *
   * An inactive fold tree retains its fold definition but does not affect the
   * visible navigation projection.
   */
  active: boolean;

  /**
   * The fold-state tree stored in this slot.
   */
  tree: FoldNodeModel<Id>;
}>;

/**
 * Serializable representation of Folds.
 *
 * `null` represents an unoccupied non-primary slot. Do not use `undefined`:
 * JSON serialization converts undefined array entries to null anyway.
 */
export type FoldsModel<Id extends SerializableKey> = Readonly<{
  slots: readonly [FoldSlotModel<Id>, ...(FoldSlotModel<Id> | null)[]];
}>;

/**
 * Creates a schema for the serializable fold collection.
 *
 * This validates:
 *
 * - there is always a primary slot at index zero;
 * - every occupied slot has a name, a description or `null`, active state,
 *   and a valid fold tree;
 * - every non-primary slot is either an occupied fold slot or `null`.
 *
 * A slot's `description: null` means that its fold tree has no description.
 *
 * It does not validate fold-tree names for uniqueness. That is a domain rule
 * only if the fold service decides names must be unique.
 */
export function createFoldsModelSchema<Id extends SerializableKey>(
  idSchema: z.ZodType<Id>,
): z.ZodType<FoldsModel<Id>> {
  const foldNodeSchema = createFoldNodeModelSchema(idSchema);

  const foldSlotSchema: z.ZodType<FoldSlotModel<Id>> = z
    .object({
      name: z.string(),
      description: z.string().nullable(),
      active: z.boolean(),
      tree: foldNodeSchema,
    })
    .strict();

  return z
    .object({
      slots: z
        .tuple([foldSlotSchema])
        .rest(z.union([foldSlotSchema, z.null()])),
    })
    .strict();
}
