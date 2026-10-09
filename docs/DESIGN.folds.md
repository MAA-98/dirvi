# Design Choices: Vim-like Folding in Trees

This is a record of design decisions and their justifications. Previous design choices influence the next, so this is
to be interpreted chronologically.

## Folding children in a parent node

**Requirement:**

1. Children of a node can be hidden ("folded") so showing children is not
   always all or nothing.
2. Since children are not ordered, the folded children are all collected in
   one bucket.

**Implications:**

There needs to be some way to show children are hidden, and how many.
There are two clear methods to do that:

1. A fold is a special entry with the other nodes:

```txt
directory/
  file0
  file1
  ... 1 folded
```

placed at the beginning or the end.

2. Folds are a property of branch nodes and displayed inline:

```txt
directory/ …1
  file0
  file1
```

**_Decision:_**

Because vertical space is easily squandered in displaying the tree, the second method is preferable,
putting the fold information horizontally inline with the branch node.

Until 0.8 version, `dirvi` used the first method because the related controls are easier to design
(simply `zo` while cursor is over the fold row.) The controls with the "branch inline folding" are less
clear.

A starting design could be `zc` over a node folds it in the parent, and `zo` over a parent with folded
children unfolds all the children.

## Inspecting folds

**Requirement:**

1. Being able to see which entries are folded without unfolding.
2. Unfold a select few children, rather than in the current design (0.8.x) of `zo` over a branch with folds unfolding
   all its children.

**Implications:**

Like in the design of Vim's folds, there should be a way to toggle a "fold" between active and inactive states. This
allows "peeking" the hidden entries without having to delete all children at a branch from the fold tree.

Since there's nothing special about the active fold tree, it makes sense to be able to have multiple fold trees
active/inactive and refer to them by name.

An entry is hidden when at least one active fold tree contains it. Removing it from one fold tree does not expose it
while another active fold tree contains it.

**_Decision:_**

Have a dictionary of fold trees, instead of just one. Toggle whether a fold tree is active using:

```
:fold enable [foldTreeName]   # tree contributes to hiding entries
:fold disable [foldTreeName]  # tree no longer contributes to hiding entries

:fold close [foldTreeName]    # alias for :fold enable
:fold open [foldTreeName]     # alias for :fold disable

:fold toggle [foldTreeName]
```

in command mode. When `foldTreeName` is omitted, it refers to
the fold tree named `default`.

In normal mode `[index]zc` enables the fold tree (hides its entries from UI), `[index]zo` disables the fold tree:
reveals its entries if no other active tree hides them, and `[index]za` toggles.

Similarly `[index]zf` adds the current entry to the fold tree at `[index]` and `[index]zd` removes the current entry
from the fold tree at `[index]`.

Enabling or disabling a fold tree changes whether its whole definition contributes to visibility. Adding or removing an
entry changes the definition of one fold tree. These are separate operations.

Controls for managing fold trees should also be added:

```
:fold list
:fold create foldTreeName
:fold delete foldTreeName
```

A fresh view will start with an empty fold tree named `default` and index `0`. Fold commands with no index or name
default to that one.

A fresh view starts with an empty, non-deletable fold tree at index `0`, named
`default`. Its name may be changed. Fold commands without an index or name
target the fold tree at index `0`.

Indexes identify fold trees within the current view. When a fold tree is
deleted, its index may be reused by a newly created fold tree. Names are the
durable user-facing references to fold trees.

TODO Later: Add command `:fold rename oldName newName` and `:fold copy oldName newName`
