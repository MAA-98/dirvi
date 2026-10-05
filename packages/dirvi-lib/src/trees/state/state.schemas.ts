import { z } from 'zod';
import type { Cursor } from '../cursor.js';
import type { FoldsModel } from '../fold-node/index.js';
import type { SerializableKey, TreeNodeModel } from '../tree-node/index.js';

/**
 * Serializable persistence/interchange model for tree-surfer state.
 *
 * This is intentionally distinct from runtime `State`: its root and folds use
 * public structural models, while runtime state holds opaque TreeNode and
 * Folds values.
 */
export type StateModel<Id extends SerializableKey, Value> = Readonly<{
  root: TreeNodeModel<Id, Value>;
  folds: FoldsModel<Id>;
  cursor: Cursor<Id>;
}>;

/**
 * Creates a schema for the serializable StateModel DTO.
 *
 * This validates only the persistence representation. Applications must decode
 * the validated root and folds models through their specialized TreeNodeApi and
 * FoldsApi before constructing opaque runtime State.
 */
export function createStateModelSchema<Id extends SerializableKey, Value>(
  rootSchema: z.ZodType<TreeNodeModel<Id, Value>>,
  foldsSchema: z.ZodType<FoldsModel<Id>>,
  cursorSchema: z.ZodType<Cursor<Id>>,
): z.ZodType<StateModel<Id, Value>> {
  return z
    .object({
      root: rootSchema,
      folds: foldsSchema,
      cursor: cursorSchema,
    })
    .strict();
}
