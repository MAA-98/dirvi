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
 * Branded ID types prevent IDs from unrelated domains from being mixed
 * accidentally, even when both use strings at runtime.
 *
 * @example
 *
 * ```ts
 * const myIdSchema = z
 *   .string()
 *   .min(1)
 *   .brand<'MyId'>();
 *
 * type MyId = z.output<typeof myIdSchema>;
 *
 * type MyItem = Readonly<{
 *   label: string;
 *   href?: string;
 * }>;
 *
 * type MyTreeModel = TreeNodeModel<MyId, MyItem>;
 * ```
 */
export type SerializableKey = string | number;

/**
 * Validates a serializable primitive suitable for use as a tree-node ID.
 *
 * Strings are accepted without additional restrictions. Numbers must be
 * finite: `NaN`, `Infinity`, and `-Infinity` are rejected.
 *
 * Applications can derive narrower schemas to impose domain-specific
 * restrictions or produce branded ID types.
 *
 * @remarks
 *
 * Requires Zod v4, where `z.number()` rejects non-finite values.
 */
export const serializableKeySchema: z.ZodType<SerializableKey> = z.union([
  z.string(),
  z.number(),
]);
