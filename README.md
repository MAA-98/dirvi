# dirvi

A terminal UI for browsing directories as an expandable tree.

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

### Piping Stdout

`dirvi` can be connected to another process through stdout.
For example:

```sh
dirvi | jq --unbuffered -c '.' > dirvi-output.json
```

> Warning: When stdout is connected to a pipe, some terminals and color libraries disable color automatically.

Set `FORCE_COLOR=3` to preserve the colored tree output:

```sh
FORCE_COLOR=3 dirvi | jq --unbuffered -c '.' > dirvi-output.json
```

For convenience, you can define an alias:

```sh
alias dirvi-pipe='FORCE_COLOR=3 dirvi'
```

with zshell:

```
echo "alias dirvi-pipe='FORCE_COLOR=3 dirvi'" >> ~/.zshrc
source ~/.zshrc
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

| Key sequence    | Action |
| --------------- | ------ |
| `[index]zf`     | Add the current entry to the fold tree at `index` |
| `[index]zd`     | Remove the current entry from the fold tree at `index` |
| `[index]zc`     | Enable the fold tree at `index`, hiding its entries |
| `[index]zo`     | Disable the fold tree at `index`, revealing entries not hidden by another enabled fold tree |
| `[index]za`     | Toggle whether the fold tree at `index` is enabled |

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

| Command | Action |
| ------- | ------ |
| `:q` | Quit `dirvi` |
| `:evlp` | Experimental: Send to stdout an array of paths of the visible leaves |
| `:fold list` | List fold trees in the current view |
| `:fold create <name>` | Create a named fold tree |
| `:fold delete <name>` | Delete a named fold tree |
| `:fold enable [name]` | Enable a fold tree so its entries are hidden |
| `:fold disable [name]` | Disable a fold tree so it no longer hides entries |
| `:fold close [name]` | Alias for `:fold enable` |
| `:fold open [name]` | Alias for `:fold disable` |
| `:fold toggle [name]` | Toggle whether a fold tree is enabled |

When a fold command omits `name`, it targets the fold tree named `default`.

An unknown command returns to Normal mode without changing the directory tree.

## Open/Close Directory

Opening and closing affect the materialized tree in the TUI:

- Opening a directory creates its child entries in the buffer.
- Closing a directory removes its descendants from the buffer.
- Opening a directory does not automatically open its child directories.

> WARNING: Folding is a separate mechanism. It controls the visibility of entries while preserving their directory open/closed state.

### Opening directories

When the cursor is on a closed directory, press `l` or Right to open it:

```text
src/
```

becomes:

```text
src/
  main.ts
  util.ts
```

The cursor remains on `src/`. Press Down to move into its children.

When the cursor is on an already-open directory, press `l` or Right to close it.

### Closing directories

Closing a directory removes its descendants from the visible tree:

```text
project/
  src/
    components/
      Button.tsx
```

becomes:

```text
project/
```

Closing a directory also closes all descendant directories. Reopening it reveals its immediate children, but does not automatically reopen the entire subtree.

## Navigation

Navigation is based on visible entries only:

- Down moves to the next entry currently shown in the tree.
- Up moves to the previous entry currently shown.
- A closed directory has no visible children.
- Files and symlinks have no children.
- Right opens a closed directory but does not move into it.
- Down is used to enter an opened directory.
- Left always moves toward the parent.

### Moving to parents

`h` or Left always moves the cursor to the parent directory. It does not close the current directory.

For example:

```text
project/
  src/
    main.ts
```

With the cursor on `main.ts`, pressing Left moves to `src/`. Pressing it again moves to `project/`.

If the cursor is on an open or closed directory, Left still moves toward its parent without changing its open/close state.

## Folding

Folding is separate from opening and closing directories. Instead of a single
fold state, each view has a collection of named **fold trees**. A fold tree
contains entries that it can hide, and the fold tree can be independently enabled or
disabled.

An entry is hidden when it belongs to at least one enabled fold tree. Disabling
one fold tree reveals its entries only when no other enabled fold tree also
contains them.

Folded children are represented inline on their parent branch, preserving
vertical space. A branch with folded children shows a folded-entry count, for
example:

```text
directory/ … 1
  file0
  file1
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

Folding an open directory does not close it. Its descendants retain their own
open, closed, and fold membership state.

Fold state is independent of the materialized directory buffer:

- Closing a directory removes its loaded descendants.
- Closing a directory does not remove fold-tree membership.
- Reopening a directory reloads its entries and reapplies enabled fold trees.
- Adding or removing an entry from a fold tree does not change whether its
  directory is open.

## Licensing

- The terminal application (`packages/dirvi-cli`) is licensed under the GPLv3.
- The internal library (`packages/dirvi-lib`) is licensed under the LGPLv3.
