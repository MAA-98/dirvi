# Design Choices: Vim-like Commands, Feedback and Messages

This is a record of design decisions and their justifications. Previous design choices influence the next, so this is
to be interpreted chronologically.

## Modal Editing

**Requirement:**

1. Commands reminiscent of Neo/Vim, and easy for users of it to pick up and use.
2. It must be general enough to be the same for various tree structures: file directories, ASTs, git trees, etc.

**_Decision:_**

A normal mode for shortcuts and command mode for Ex-style commands will be expected and natural for Vim users. Insert
mode only makes sense in the context of text buffers, so it's not implemented but `i` can be reserved for app specific
shortcuts.

To display Ex command buffer, modes, normal modes command buffer, and additional status parts, there is a status bar at
the bottom as in Neo/Vim,

## Feedback

**Requirement:**

1. Displaying feedback or error messages from commands or internals.

**_Decision:_**

Have a section above the status bar for displaying messages. We'll call it the _feedback bar_. It should take a
section of the UI, meaning it is not overlaying the tree but taking a portion of the screen, as the status bar.

A new message clears previous one. We will add more functionality and configs later on.
