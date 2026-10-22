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

/**
 * A structural model for persisting or exchanging a tree node.
 *
 * @remarks
 *
 * This model is independent of the opaque runtime tree representation.
 * It consists of ordinary objects and ordered child arrays.
 *
 * The presence and value of `children` distinguish three node states:
 *
 * - Absent: a leaf, which cannot contain children.
 * - `null`: a branch whose children have not been loaded.
 * - An array: a branch whose children are loaded, possibly with no children.
 *
 * Loaded children form an ordered sequence. Their array positions describe
 * child order, while their IDs identify them independently of those positions.
 * Direct siblings must have unique IDs.
 *
 * The model is suitable for JSON serialization when `Id` and `Value` are
 * JSON-serializable. The generic `Value` type does not itself guarantee this.
 *
 * `Readonly` prevents structural mutation through these types at compile time.
 * It does not freeze objects at runtime or make application-owned values
 * deeply immutable.
 *
 * Models represent finite trees, not cyclic object graphs.
 *
 * @typeParam Id - The type identifying each node among its direct siblings.
 * @typeParam Value - Application-owned data associated with each node.
 */
export type TreeNodeModel<Id extends SerializableKey, Value> =
  | LeafTreeNodeModel<Id, Value>
  | UnloadedBranchTreeNodeModel<Id, Value>
  | LoadedBranchTreeNodeModel<Id, Value>;

/**
 * A structural model of a leaf node.
 *
 * A leaf cannot contain children. This is distinct from a loaded branch
 * whose child array is currently empty.
 *
 * @typeParam Id - The type identifying this node among its direct siblings.
 * @typeParam Value - Application-owned data associated with this node.
 */
export type LeafTreeNodeModel<Id extends SerializableKey, Value> = Readonly<{
  id: Id;
  value: Value;
  children?: never;
}>;

/**
 * A structural model of a branch whose children have not been loaded.
 *
 * The branch may contain children, but their identities, order, and values
 * are unavailable in this model. `null` does not mean the branch is empty.
 *
 * @typeParam Id - The type identifying this node among its direct siblings.
 * @typeParam Value - Application-owned data associated with this node.
 */
export type UnloadedBranchTreeNodeModel<
  Id extends SerializableKey,
  Value,
> = Readonly<{
  id: Id;
  value: Value;
  children: null;
}>;

/**
 * A structural model of a branch with loaded children.
 *
 * An empty child array represents a loaded branch with no current children,
 * not a leaf. The branch can still contain children.
 *
 * @typeParam Id - The type identifying this node among its direct siblings.
 * @typeParam Value - Application-owned data associated with this node.
 */
export type LoadedBranchTreeNodeModel<
  Id extends SerializableKey,
  Value,
> = Readonly<{
  id: Id;
  value: Value;
  children: readonly TreeNodeModel<Id, Value>[];
}>;

/**
 * Creates a recursive schema for validating structural tree-node models.
 *
 * @remarks
 *
 * The supplied schemas validate every node's ID and application-owned value.
 * The returned schema validates the three node shapes recursively:
 *
 * - Leaves omit `children`.
 * - Unloaded branches have `children: null`.
 * - Loaded branches have an ordered array of valid child models.
 *
 * Node objects are strict: properties other than `id`, `value`, and the
 * appropriate `children` property are rejected. Validation of properties
 * inside `value` is controlled by `valueSchema`.
 *
 * Child arrays are parsed in their existing order; this schema does not sort
 * or reorder children.
 *
 * This schema validates shape and field values, but does not enforce
 * sibling-ID uniqueness. That invariant must be checked when constructing
 * runtime tree nodes or by an additional validation step.
 *
 * The supplied ID schema is responsible for enforcing the runtime ID
 * constraints, including finite numeric IDs. The generic constraint alone
 * cannot enforce those restrictions.
 *
 * Inputs must describe finite trees. Cyclic object graphs are not supported.
 *
 * @typeParam Id - The validated node-ID type.
 * @typeParam Value - The validated application-value type.
 * @param idSchema - Schema used to validate every node's ID.
 * @param valueSchema - Schema used to validate every node's application data.
 * @returns A recursive schema for the application's tree-node models.
 *
 * @example
 *
 * ```ts
 * const myIdSchema = serializableKeySchema
 *   .pipe(z.string().min(1))
 *   .brand<'MyId'>();
 *
 * type MyId = z.output<typeof myIdSchema>;
 *
 * const modelSchema = createTreeNodeModelSchema(
 *   myIdSchema,
 *   z.object({ label: z.string() }).strict(),
 * );
 *
 * const model = modelSchema.parse({
 *   id: 'root',
 *   value: { label: 'My' },
 *   children: [
 *     {
 *       id: 'home',
 *       value: { label: 'Home' },
 *     },
 *     {
 *       id: 'settings',
 *       value: { label: 'Settings' },
 *       children: null,
 *     },
 *   ],
 * });
 * ```
 */
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
