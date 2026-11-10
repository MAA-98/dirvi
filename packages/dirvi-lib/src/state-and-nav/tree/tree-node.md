# Design

## Motivation

Tree nodes are the underlying data structure used to represent interactive
hierarchical data such as:

- file directories;
- HTML/XML
- ASTs,
- s-expressions; and
- other application-specific tree structures.

Children of a node form an ordered sequence. The API preserves this order
throughout but whether child order has application-level meaning is up to
the consumer.

## Node Identity

Every node has an `id` that identifies it among its direct siblings,
independently of its position and application-owned value.
Sibling IDs must be unique, but need not be unique across the tree.

Two values have to be excluded from potentially being an Id: `NaN` and
`undefined`, which are edge cases in implementation.

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
