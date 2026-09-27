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
export declare const serializableKeySchema: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
/**
 * Helper for creating the schemas for the structural variants of a tree node.
 *
 * The concrete application can extend these schemas with additional fields.
 */
export declare function createTreeNodeSchemas<Id extends SerializableKey, Node extends TreeNode<Id, Node>>(idSchema: z.ZodType<Id>, nodeSchema: z.ZodType<Node>): {
    leafSchema: z.ZodObject<{
        id: z.ZodType<Id, unknown, z.core.$ZodTypeInternals<Id, unknown>>;
    }, z.core.$strip>;
    closedBranchSchema: z.ZodObject<{
        id: z.ZodType<Id, unknown, z.core.$ZodTypeInternals<Id, unknown>>;
        children: z.ZodNull;
    }, z.core.$strip>;
    openBranchSchema: z.ZodObject<{
        id: z.ZodType<Id, unknown, z.core.$ZodTypeInternals<Id, unknown>>;
        children: z.ZodArray<z.ZodType<Node, unknown, z.core.$ZodTypeInternals<Node, unknown>>>;
    }, z.core.$strip>;
};
//# sourceMappingURL=tree-node.schemas.d.ts.map