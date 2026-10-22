# Design Choices: Vim-like Commands, Feedback and Messages

This is a record of design decisions and their justifications. Previous design choices influence the next, so this is
to be interpreted chronologically.

### Modal Editing 1

**Requirement:**

1. Commands reminiscent of Neo/Vim, and easy for users of it to pick up and use.
2. It must be general enough to be the same for various tree structures: file directories, ASTs, git trees, etc.

**_Decision:_**

A normal mode for shortcuts and command mode for Ex-style commands will be expected and natural for Vim users. Insert
mode only makes sense in the context of text buffers, so it's not implemented.

To display Ex command buffer, modes, normal modes command buffer, and additional status parts, there is a status bar at
the bottom as in Neo/Vim.

### Navigation 1

**Requirement:**

1. Provide fast navigation reminiscent of Neo/Vim, adapted to tree structures rather than text.
2. Navigation must work consistently across different tree structures.

**Implications:**

While the arrow keys for directional navigation work as a conventional starting point, naive mapping of `h, j, k, l` to 
the directional navigation starts to actually be counter-intuitive once we want to add more of the standard motions for 
navigation. 

For example, if we want to add `0` and `$` in a way analogous to Vim, the most intuitive meaning would be to move to the 
first and last child of the current entries' parent. This then implies a metaphor: a line in Vim is a parent's children 
in `dirvi`. But, that disagrees with `j` going to next entry down rather than going to next parent's children.

**_Decision:_**

Keep arrow keys as conventional directional navigation, for 'normies', but hold to the analogy of

```txt
The parent's children are a line.
```

as a guiding principle for Vim-like keybindings. This has immediate consequences:

- `j`, `k` move to next/previous parent's children,
- `h`, `l` move to next/previous child in current parent, with overflow going to next/previous parent's children, or just 
the next/previous child in the parent's parent, 
- `0`, `^`, `$` move within the parent's children,
- `{`, `}` move to the next child of the parent that is not an open branch with children.

### Feedback 1

**Requirement:**

1. Displaying feedback or error messages from commands or internals.

**_Decision:_**

Have a section above the status bar for displaying messages. We'll call it the _feedback bar_. It should take a
section of the UI, meaning it is not overlaying the tree but taking a portion of the screen, as the status bar.

A new message clears previous one. We will add more functionality and configs later on.
