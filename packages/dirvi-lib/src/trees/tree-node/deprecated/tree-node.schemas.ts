import { z } from 'zod';
import { SerializableKey, TreeNode } from './tree-node.types.js';

/**
 * Runtime schema for IDs that can be safely represented as serializable
 * primitive values.
 *
 * Strings are accepted as-is. Numbers must be finite, so `NaN`, `Infinity`,
 * and `-Infinity` are rejected.
 *
 * Applications should derive a more specific schema when those constraints
 * are needed.
 */
export const serializableKeySchema = z.union([z.string(), z.number().finite()]);

/**
 * Helper for creating the schemas for the structural variants of a tree node.
 *
 * The concrete application can extend these schemas with additional fields.
 */
export function createTreeNodeSchemas<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(idSchema: z.ZodType<Id>, nodeSchema: z.ZodType<Node>) {
  const leafSchema = z.object({
    id: idSchema,
  });

  const closedBranchSchema = z.object({
    id: idSchema,
    children: z.null(),
  });

  const openBranchSchema = z.object({
    id: idSchema,
    children: z.array(nodeSchema),
  });

  return {
    leafSchema,
    closedBranchSchema,
    openBranchSchema,
  };
}
