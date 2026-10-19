# Ex Commands List

This lists all "Ex" commands (the bottom command line) in dirvi.

# Dirvi Shell

| Command                                                                         | Action                                           |
|---------------------------------------------------------------------------------|--------------------------------------------------|
| `:q`                                                                            | Quit `dirvi`                                     |
| `:app list`                                                                     | List all registered apps                         |
| `:app [id] <input>` and `:app open [id] <input>` and `:app switch [id] <input>` | Switch to app with id `[id]` and input `<input>` |

# Folds

| Command                                        | Action                                            |
|------------------------------------------------|---------------------------------------------------|
| `:fold list`                                   | List fold trees in the current view               |
| `:fold create <name>`                          | Create a named fold tree                          |
| `:fold delete <name>`                          | Delete a named fold tree                          |
| `:fold enable [name]` and `:fold close [name]` | Enable a fold tree so its entries are hidden      |
| `:fold disable [name]` and `:fold open [name]` | Disable a fold tree so it no longer hides entries |
| `:fold toggle [name]`                          | Toggle whether a fold tree is enabled             |

