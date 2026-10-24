# dirvi

A TUI for navigating and interacting with tree structures. Heavily inspired by Vim/Neovim,
to provide a similar extensible editing environment, but for trees rather than text buffers.

## Design Goals

- Focused, composable, extendable. **Be really good at one thing: navigating trees.**
- Simple configurations and APIs. **Fearless improvements until out of beta.**
- Modal editing, adapted from Vim for tree structures.
- Example of an unordered `dirvi` app: file system editor.
- Example of an ordered `dirvi` app: XML editor.

Answering the question:
https://vi.stackexchange.com/questions/29417/how-can-i-edit-trees-in-vim

## Installation

Install `dirvi` globally with npm:

```sh
npm install -g @mak-98/dirvi-cli
```

## Usage

Launch `dirvi` from the directory you want to browse:

```sh
dirvi
```

## Controls

`dirvi` has two input modes:

- **Normal mode** is used for navigating and interacting with the directory tree.
- **Command-line mode** is used to enter commands beginning with `:`.

The current input mode and pending input are shown in the status bar at the bottom of the terminal.

### Normal mode

Normal mode is the default mode when `dirvi` starts.

#### Single Key

| Key         | Action                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| `j` / Down  | Move to the next visible entry                                           |
| `k` / Up    | Move to the previous visible entry                                       |
| `h` / Left  | Move to the parent directory                                             |
| `l` / Right | Open or close a directory; send a file path when the cursor is on a file |
| `:`         | Enter command-line mode                                                  |
| `Esc`       | Clear a pending normal-mode command                                      |

#### Multi-key

##### Folds

| Key sequence | Action                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| `[index]zf`  | Add the current entry to the fold tree at `index`                                           |
| `[index]zd`  | Remove the current entry from the fold tree at `index`                                      |
| `[index]zc`  | Enable the fold tree at `index`, hiding its entries                                         |
| `[index]zo`  | Disable the fold tree at `index`, revealing entries not hidden by another enabled fold tree |
| `[index]za`  | Toggle whether the fold tree at `index` is enabled                                          |

`index` is a non-negative fold-tree index. When omitted, it defaults to `0`,
which is the default fold tree. For example, `2zf` adds the current entry to
fold tree `2`, while `zc` enables the default fold tree.

### Command-line mode

Press `:` in Normal mode to enter command-line mode.
The status bar displays the command line at the bottom left.

| Key         | Action                                       |
| ----------- | -------------------------------------------- |
| Characters  | Append characters to the command line        |
| `Backspace` | Remove the last character                    |
| `Enter`     | Execute the command                          |
| `Esc`       | Cancel the command and return to Normal mode |

Currently supported commands:

| Command                | Action                                                               |
| ---------------------- | -------------------------------------------------------------------- |
| `:q`                   | Quit `dirvi`                                                         |
| `:fold list`           | List fold trees in the current view                                  |
| `:fold create <name>`  | Create a named fold tree                                             |
| `:fold delete <name>`  | Delete a named fold tree                                             |
| `:fold enable [name]`  | Enable a fold tree so its entries are hidden                         |
| `:fold disable [name]` | Disable a fold tree so it no longer hides entries                    |
| `:fold close [name]`   | Alias for `:fold enable`                                             |
| `:fold open [name]`    | Alias for `:fold disable`                                            |
| `:fold toggle [name]`  | Toggle whether a fold tree is enabled                                |

When a fold command omits `name`, it targets the fold tree named `default`.

An unknown command returns to Normal mode without changing the directory tree.

## Loading/Unloading Parents

Loading and unloading affect the materialized tree in the TUI:

- Loading a parent creates its child entries in the buffer.
- Unloading a parent removes its descendants from the buffer.
- Loading a parent does not automatically load its child descendants.

> WARNING: Folding is a separate mechanism. It controls the visibility of entries while 
> they are loaded. Unloading does not automatically fold or unfold the descendants.

## Folding

Folding is separate from (un)loading directories. A active app has a collection of
named **fold trees**. A fold tree contains entries that it should hide if active, 
and each fold tree can be independently made active or inactive.

An entry is hidden when it belongs to at least one active fold tree. Disabling
one fold tree reveals its entries only when no other enabled fold tree also
contains them.

For unordered trees, folded children are represented on their parent branch, 
conserving vertical space. A branch with folded children shows a folded-entry
count, for example:

```text
directory/ … 1
  file0
  file1
```

For ordered trees, folded children are displayed inline in a contiguous block, 
closer to how Vim/Neovim displays folded lines.

```text
directory/
  file0
  … 2
  file3
```

### Default fold tree

A fresh view contains an empty fold tree:

- Its name is `default`.
- Its index is `0`.
- Normal-mode fold commands without an index target it.
- Command-line fold commands without a name target it.

Indexes identify fold trees within the current view. If a fold tree is deleted,
its index may later be reused. Names are the durable, user-facing way to refer
to fold trees from command-line commands.

### Managing fold membership

Use `[index]zf` to add the entry under the cursor to a fold tree and
`[index]zd` to remove it. These commands change the definition of a fold tree;
they do not enable or disable it.

Use `[index]zc`, `[index]zo`, and `[index]za` to enable, disable, or toggle a
fold tree. These commands change whether the fold tree contributes to entry
visibility; they do not alter its membership.

### Relationship to directory opening

Folding a parent with loaded children does not unload it. Its descendants 
retain their own load and fold state.

Fold state is independent of the materialized directory buffer:

- Unloading a node does not remove fold-tree membership.
- Reloading a parent reloads its children and reapplies active fold trees.

## FAQ

- What is the use case?

I use the directory app for navigating project files, with folds now becoming
the indispensable way for me to quickly view files relevant to a specific part
of a project. I use the XML editor, with various scripts for custom commands,
for creating LLM prompts.

- Why make it a separate app instead of a Vim/Neovim plugin?

I don't know Vimscript or Lua well enough. I wanted to focus on design and easy
iteration rather than how to make it work as a plugin, so I wrote it as standalone.
In the making, I do believe the UX is better than a Vim/Neovim plugin.

- Why write it using TypeScript/React/Ink?

As for the answer above, it was the easiest way for me to get started. It had the 
consequence of making plugins and scripts for commands very approachable. It also
allows possible future rewrites in Rust to be incremental.

## Licensing

- The terminal application (`packages/dirvi-cli`) is licensed under the GPLv3.
- The internal library (`packages/dirvi-lib`) is licensed under the LGPLv3.
