# Design

## Motivation

Tree nodes are the underlying data structure used to represent interactive
hierarchical data such as:

- file directories;
- Git branches and commits;
- navigation trees;
- ASTs; and
- other application-specific tree structures.

## Node Identity

Every node has a stable `id` that identifies the node amongst siblings even if other properties change.
Sibling IDs should be unique, but doesn't have to be unique across the tree.

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

## Branch Nodes

The branch nodes (nodes with children) are made to be lazily loaded for the app UI. 
Therefore, unloaded is represented by `children: null`.

### Note:

Because leaves are detected by property presence:

```
'children' in node
```

enable:

```json
{
  "compilerOptions": {
    "exactOptionalPropertyTypes": true
  }
}
```