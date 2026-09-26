# Design

## Motivation

The fold-state tree keeps track of folded buffer entries independently of the
currently loaded buffer tree.

The buffer tree is the source of truth for:

- buffer entries;
- entry order;
- buffer-specific properties;
- which branches are loaded; and
- the current contents of the application.

The fold-state tree is the source of truth only for folding. This separation
allows fold state to survive buffer reloads and lazy loading.

## Sparse Projection

A fold-state tree is a sparse projection of a buffer tree. It does not contain
every buffer entry.

A fold-state node is included when:

- the corresponding buffer entry is folded; or
- there is fold state somewhere below the corresponding buffer entry.

A buffer entry with no fold state at or below it is omitted from the
fold-state tree.

For example, given this buffer tree:

```text
root
├── src
│   ├── main.ts
│   └── lib
└── test
```

if only `src/lib` is folded, the fold-state tree may contain:

```text
root
└── src
    └── foldedChildren: [lib]
```

`main.ts` and `test` do not need to appear in the fold-state tree because they
have no fold state.

The root is always retained, even when it has no fold state.

## Node Collections

Each `FoldNode` has two collections of direct fold-state children:

```ts
type FoldNode<Id> = {
  id: Id;
  children: FoldNode<Id>[];
  foldedChildren: FoldNode<Id>[];
};
```

### `children`

`children` contains direct buffer entries that are not folded at the current
node but have fold state somewhere below them.

For example, if `src/lib` is folded but `src` itself is not folded:

```text
root
└── children: [src]
    └── foldedChildren: [lib]
```

The `src` node is present because it is needed to preserve the path to `lib`.

### `foldedChildren`

`foldedChildren` contains direct buffer entries whose contents are folded at
the current node.

A folded entry is represented by a complete `FoldNode`, rather than only by its
ID. This allows fold state below the folded entry to be preserved:

```text
root
└── foldedChildren: [src]
    └── foldedChildren: [lib]
```

In this example, `src` is folded at the root and `lib` has fold state below
`src`.

The fold-state tree may preserve this nested information even though the
corresponding buffer subtree is currently hidden or unloaded.

## Invariants

For every fold-state node:

- no ID appears more than once in `children`;
- no ID appears more than once in `foldedChildren`;
- no ID appears in both collections;
- every ID in either collection identifies a direct child of the
  corresponding buffer-tree node;
- an entry with no fold state at or below it is omitted.

Consequently, the union of `children` and `foldedChildren` is generally only a
subset of the corresponding buffer node's direct children.

The arrays do not define buffer display order. The buffer tree remains
responsible for the order of entries. The order of `children` and
`foldedChildren` is therefore not semantically significant.

## Structural Tree Operations

`FoldNode` has a `children` property and can therefore be used with
`TreeNodeApi`.

`FoldNodeApi` provides structural operations over the `children` collection,
including:

- finding a node at a path;
- selecting a node at a path; and
- immutably modifying a node at a path.

These operations do not interpret `foldedChildren`.

A path passed to `FoldNodeApi` follows structural `children` only:

```text
root
└── children
    └── children
```

A node that exists only in `foldedChildren` is not reachable through
`FoldNodeApi`.

## Fold-State Service Operations

`FoldNodeService` provides semantic operations for adding and removing folded
entries.

Its paths are relative to the fold-state root:

```text
[]                    root
['src']               root/src
['src', 'lib']        root/src/lib
```

The current service operates at unfolded nodes only. It resolves paths through
`children` and does not modify or traverse descendants stored inside
`foldedChildren`.

### Folding an entry

To fold a direct entry:

1. resolve the parent node through `children`;
2. remove the entry from `children`, if it is present;
3. add the entry to `foldedChildren`; and
4. preserve any nested fold state already stored on that entry.

For example:

```text
Before:

root
└── children: [src]

After folding src:

root
└── foldedChildren: [src]
```

Folding an entry that is already in `foldedChildren` is idempotent.

Missing structural nodes may be created while resolving the requested path.
This allows fold state to be built lazily without loading the complete buffer
tree.

### Unfolding an entry

To unfold a direct entry:

1. resolve the parent node through `children`;
2. remove the entry from `foldedChildren`;
3. move it to `children` if it still contains nested fold state; and
4. omit it entirely if it has no remaining fold state.

For example:

```text
Before:

root
└── foldedChildren: [src]

After unfolding src:

root
└── children: []
```

If `src` contains nested fold state, it is preserved when `src` moves back to
`children`.

## Immutability

Fold-state updates are immutable.

An update creates:

- a new root;
- new nodes along the modified path; and
- new arrays for changed collections.

Unrelated nodes and arrays retain their existing object identity.

This allows fold-state updates to work with reducer-based application state and
makes it possible to detect unchanged updates by reference identity.

## Relationship to the Buffer Tree

The fold-state tree does not validate the existence of buffer entries by
itself. A buffer entry ID in `children` or `foldedChildren` is expected to
correspond to a direct child in the buffer tree, but the fold-state tree does
not contain the buffer entry's properties.

The buffer tree remains authoritative for:

- whether an entry exists;
- whether an entry is a leaf or branch;
- the order of entries;
- the loaded or unloaded state of a branch; and
- application-specific node data.

The fold-state tree remains authoritative for:

- whether a direct entry is folded; and
- preserved fold state below folded entries.