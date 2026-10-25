# Design

## Motivation

Tree nodes are the underlying data structure used to represent interactive
hierarchical data such as:

- file directories;
- HTML/XML
- ASTs,
- s-expressions; and
- other application-specific tree structures.

Children form an ordered sequence. The API preserves this order during
construction, inspection, updates, and model conversion.

Whether child order has application-level meaning is outside this layer.

## Node Identity

Every node has an `id` that identifies it among its direct siblings,
independently of its position and application-owned value.
Sibling IDs must be unique, but need not be unique across the tree.

The library uses the following ID type for serializability and fast lookup:

```ts
export type SerializableKey = string | number;
```

Numeric IDs must be finite. `NaN`, `Infinity`, and `-Infinity` are not valid
IDs. TypeScript cannot express the exclusion of these values from `number`, so
values received at the app boundary should be validated at runtime.

Applications should define more specific ID types, such as branded types.
Using different branded ID types prevents IDs from unrelated domains from
being mixed accidentally, even when both have the same underlying type.

## Child Order

Loaded children form an ordered sequence with unique sibling IDs.

Construction and child-replacement operations preserve the supplied
iterable's iteration order. Child inspection exposes that same order, and
conversion to and from `TreeNodeModel` preserves it at every loaded branch.

Updating a descendant preserves its position among siblings, even if the
replacement has a different ID. Other siblings retain their relative order.

Child order is independent of node identity: paths address nodes by sibling
ID, not by sequence index.

These are API guarantees. The backing storage representation remains private.

## Node Kinds and Loading State

A node is one of:

- A leaf, which cannot contain children.
- An unloaded branch, whose children are not currently available.
- A loaded branch, whose ordered children are available and may be empty.

Loading state is independent of UI expansion or folding.

In `TreeNodeModel`, these states are represented by an absent `children`
property, `children: null`, and a child array, respectively.

The opaque runtime representation is private. Use `TreeMethods` to inspect
a runtime node's kind and children.

### TypeScript configuration

Enable `exactOptionalPropertyTypes` so that `children?: never` rejects
an explicitly supplied `children: undefined`:

```json
{
  "compilerOptions": {
    "exactOptionalPropertyTypes": true
  }
}
```

## Root

Any tree node can serve as the root supplied to `TreeMethods`.
The tree layer does not require it to be a branch or to have loaded children.

Paths are relative to the supplied root: `[]` addresses the root itself.
