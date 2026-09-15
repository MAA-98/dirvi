# dirvi

A terminal UI for browsing directories as an expandable tree.

## Installation

Install `dirvi` globally with npm:

```sh
npm install --global @mak-98/dirvi-cli
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

| Key sequence | Action                           |
| ------------ | -------------------------------- |
| `zc`         | Fold the current entry           |
| `zo`         | Unfold the current fold          |
| `za`         | Fold or unfold the current entry |

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

| Command | Action                                                            |
| ------- | ----------------------------------------------------------------- |
| `:q`    | Quit `dirvi`                                                      |
| `:evlp` | Experimental: Send to stdout array of paths of the visible leaves |

An unknown command returns to Normal mode without changing the directory tree.

## Open/Close Directory

Opening and closing affect the materialized tree ([`DirectoryBuffer`](packages/dirvi-lib/src/domain/state.ts)) in the TUI:

- Opening a directory creates its child entries in the buffer.
- Closing a directory removes its descendants from the buffer.
- Closing recursively closes descendant directories as well.
- Opening a directory does not automatically open its child directories.

> WARNING: Folding is a separate mechanism. It controls the visibility of entries while preserving their directory open/closed state.

### Opening directories

When the cursor is on a closed directory, press `l` or Right to open it:

```text
▸ src/
```

becomes:

```text
▾ src/
  main.ts
  util.ts
```

The cursor remains on `src/`. Press Down to move into its children.

When the cursor is on an already-open directory, press `l` or Right to close it.

### Closing directories

Closing a directory removes its descendants from the visible tree:

```text
▾ project/
  ▾ src/
    ▾ components/
      Button.tsx
```

becomes:

```text
▸ project/
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
▾ project/
  ▾ src/
    main.ts
```

With the cursor on `main.ts`, pressing Left moves to `src/`. Pressing it again moves to `project/`.

If the cursor is on an open or closed directory, Left still moves toward its parent without changing its open/close state.

## Folding

Folding is separate from opening and closing directories. It hides entries from a directory's visible tree without changing their open or closed state.

A fold can contain any direct entry in a directory:

- Files
- Symlinks
- Open and closed directories

Folding an open directory does not close it. Its descendants remain in the buffer and retain their own open, closed, and folded state.

The fold row is displayed after all visible entries and descendants of that directory. It is not part of the directory's normal entry ordering.

The fold row represents all folded direct entries in that directory. When the cursor is on the fold row, `zo` unfolds the folded entries. The cursor moves to the first unfolded entry.

Folding state is independent of the materialized directory buffer:

- Closing a directory removes its loaded descendants.
- Closing a directory does not remove its fold state.
- Reopening the directory reloads its entries and reapplies the existing folds.
- Folding or unfolding an entry does not change whether that entry's directory is open.

## Licensing

- The terminal application (`packages/dirvi-cli`) is licensed under the GPLv3.
- The internal library (`packages/dirvi-lib`) is licensed under the LGPLv3.
