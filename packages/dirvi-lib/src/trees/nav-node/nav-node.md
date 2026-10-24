# Design

## Motivation

The nav node integrates the node tree and fold state into a navigation
projection for rendering and navigating the UI.

The node tree supplies entry identity, values, loading state, and child
order. Fold state supplies which entries are hidden. The navigation
projection determines how these inputs appear and which positions can
be navigated to.

## Ordered and Unordered Navigation

The node tree always preserves child order. Whether that order has
semantic meaning is declared by the app definition.

Dirvi selects the corresponding navigation system:

- Unordered navigation collects hidden children into a summary on their
  parent.
- Ordered navigation preserves the positions of hidden children using
  navigable inline fold markers.

These are separate navigation systems over the same node-tree and
fold-state APIs. Apps declare their ordering semantics; they do not
implement either navigation system.

## Unordered Navigation

Sibling order is a presentation choice. The navigation projection may
sort siblings using its configured comparator. Without a comparator,
source child order is preserved.

Each navigation node contains:

- `entries`: visible direct children in presentation order;
- `folded`: information about hidden direct children, or `null` when
  none are present in the loaded source tree.

The `folded` property is a summary belonging to the parent. It is not
a separate navigable entry or cursor destination.

Hidden children are omitted from ordinary navigation, together with
their descendants.

## Ordered Navigation

Sibling order is part of the underlying structure. The navigation
projection preserves source child order.

Each contiguous run of hidden direct children produces one fold
marker at its position among the visible siblings.

For example, given:

```text
a b c d e f
```

with `b`, `c`, and `e` hidden, navigation presents:

```text
a
… 2 folded
d
… 1 folded
f
```

Each marker is a navigable display item. Hidden descendants are not
separately navigable.

Runs are determined by visibility across all enabled fold trees, not by
membership in one particular fold tree. One fold tree may contribute to
several runs, and several fold trees may contribute to one run.

## Paths and Navigation Positions

Source-tree paths continue to identify real nodes by sibling ID,
independently of sibling position.

Unordered navigation can use these paths for all cursor destinations,
because its fold summaries are not navigable.

Ordered navigation additionally needs positions identifying inline 
contiguous folds. 

## Loaded Data and Fold State

Both navigation systems project the currently available source tree.

Fold state may retain IDs that are not present in the currently loaded
children. Such IDs do not create display entries, fold counts, or
ordered fold markers by themselves.

The source tree remains authoritative for existence and order.
Fold state remains authoritative for whether an available entry is
hidden.