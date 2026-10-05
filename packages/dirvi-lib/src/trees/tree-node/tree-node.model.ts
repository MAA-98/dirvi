import { z } from 'zod';

/**
 * A serializable primitive suitable for use as a stable tree-node ID.
 *
 * @remarks
 *
 * A node ID identifies a node among its direct siblings. It is not required
 * to be globally unique across the whole tree: two nodes in different
 * branches may have the same ID.
 *
 * Numeric IDs must be finite. TypeScript cannot represent the exclusion of
 * `NaN`, `Infinity`, and `-Infinity` from `number`, so values received from
 * an untrusted source should be validated at an application boundary, for
 * example with `serializableKeySchema`.
 *
 * Applications should normally define a narrower domain-specific ID type.
 * Branded ID types prevent IDs from unrelated domains from being mixed
 * accidentally, even when both use strings at runtime.
 *
 * @example
 *
 * ```ts
 * const menuIdSchema = z
 *   .string()
 *   .min(1)
 *   .brand<'MenuId'>();
 *
 * type MenuId = z.output<typeof menuIdSchema>;
 *
 * type MenuItem = Readonly<{
 *   label: string;
 *   href?: string;
 * }>;
 *
 * type MenuTree = TreeNode<MenuId, MenuItem>;
 * ```
 */
export type SerializableKey = string | number;

/**
 * Validates a serializable primitive suitable for use as a stable tree-node ID.
 *
 * Strings are always accepted. Numbers must be finite: `NaN`, `Infinity`, and
 * `-Infinity` are rejected.
 */
export const serializableKeySchema: z.ZodType<SerializableKey> = z.union([
  z.string(),
  z.number(),
]);

/**
 * A structural, serializable snapshot of a tree node.
 *
 * This is a public persistence and interchange model for `TreeNode`; it is
 * not the runtime representation of an opaque `TreeNode` value.
 *
 * Loaded children are represented by an array because JSON has no native
 * unordered collection type. The array encodes an unordered collection of
 * sibling-unique nodes: its iteration order has no semantic meaning and is
 * not guaranteed to be preserved by `TreeNodeApi.fromModel`,
 * `TreeNodeApi.toModel`, or other tree operations.
 *
 * Applications that need visual or navigation order should derive ordered UI
 * rows from the tree using an explicit ordering policy.
 */
export type TreeNodeModel<Id extends SerializableKey, Value> =
  | LeafTreeNodeModel<Id, Value>
  | UnloadedBranchTreeNodeModel<Id, Value>
  | LoadedBranchTreeNodeModel<Id, Value>;

export type LeafTreeNodeModel<Id extends SerializableKey, Value> = Readonly<{
  id: Id;
  value: Value;
  children?: never;
}>;

export type UnloadedBranchTreeNodeModel<
  Id extends SerializableKey,
  Value,
> = Readonly<{
  id: Id;
  value: Value;
  children: null;
}>;

export type LoadedBranchTreeNodeModel<
  Id extends SerializableKey,
  Value,
> = Readonly<{
  id: Id;
  value: Value;
  children: readonly TreeNodeModel<Id, Value>[];
}>;

export function createTreeNodeModelSchema<Id extends SerializableKey, Value>(
  idSchema: z.ZodType<Id>,
  valueSchema: z.ZodType<Value>,
): z.ZodType<TreeNodeModel<Id, Value>> {
  let nodeSchema: z.ZodType<TreeNodeModel<Id, Value>>;

  nodeSchema = z.lazy(() =>
    z.union([
      z
        .object({
          id: idSchema,
          value: valueSchema,
        })
        .strict(),

      z
        .object({
          id: idSchema,
          value: valueSchema,
          children: z.null(),
        })
        .strict(),

      z
        .object({
          id: idSchema,
          value: valueSchema,
          children: z.array(nodeSchema),
        })
        .strict(),
    ]),
  );

  return nodeSchema;
}
