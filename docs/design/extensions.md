# Design Choices: Config and Plugins

This is a record of design decisions and their justifications. Previous design
choices influence the next, so this is to be interpreted chronologically.

## Extensible configurations

**Requirement:**

1. Like Neovim, the configuration of `dirvi` should be scriptable to allow
   increasing customization.
2. Even though TS/JS is used instead of Lua, setup and behavior should resemble
   Neovim closely enough to be easy for its users to pick up.

**Implications:**

Instead of saving and loading a static JSON configuration file, `dirvi` needs
to load and evaluate an initialization script with a narrow API for changing
configuration.

**_Decision:_**

`dirvi` evaluates an ECMAScript module named `init.mjs` during startup. The
script is evaluated before the terminal UI is entered.

While evaluating the module, `dirvi` temporarily exposes a narrow
configuration facade at:

```js
globalThis.dirvi;
```

and can also be accessed with:

```js
dirvi;
```

For example, an initialization script may change shared UI options:

```js
dirvi.options.set({
  indentSize: 4,
  firstIndent: '│ ',
});
```

The facade exposing configuration operations is available only while `init.mjs` is being evaluated.

The startup lifecycle is:

- dirvi starts
- evaluates `init.mjs`
- exposes `globalThis.dirvi`/`dirvi` temporarily
- `init.mjs` changes configuration through the exposed API
- host consumes the resolved configuration
- host enters the terminal UI

## Custom Commands

**Requirement:**

1. Custom Ex commands that control dirvi.

**Implications:**

Need a DirviApi object with methods for controlling dirvi.

Need to decide how to deal with conflicts, when two custom commands clash or
override a builtin commands.

**_Decision:_**

- DirviApi is made with shell API for control outside of current app
- Custom commands override builtins, later custom commands override earlier ones.

## Custom Apps

**Requirement:**

1. Support applications for different tree structures, such as filesystems,
   XML, ASTs, and s-expressions. This includes when children order is semantic
   or not.
2. Allow each application to define its own node values, data loading, and
   entry presentation.
3. Keep the tree runtime and interaction behavior within dirvi, rather than
   requiring each application to implement them.
4. Allow the host to run applications without knowing their concrete
   identifier and value types.

**Implications:**

An app definition needs to connect an application-specific data source to
dirvi's tree model.

For example, a filesystem app definition defines the node types, how to
read and edit directories and files. An XML app knows how to read and edit
XML nodes. Neither should need to implement its own cursor, fold-state
management, navigation runtime, or terminal UI.

The app therefore supplies an application definition, rather than
a replacement tree runtime. Dirvi uses that definition to construct
the application's runtime API.

Applications can use different identifier and value types. These types
must remain consistent within an application, but the host should not
need to name them when selecting or running an app.

**_Decision:_**

An app exposes its definition which supplies at least:

- A function for creating (the inputs for) the initial root.
- A function for loading (the inputs for) a branch's direct children.
- Whether the children have semantic order.
- A synchronous, side-effect-free function for describing a tree node's
  presentation.
- A subscription through which the app can request resynchronization.

The "(the inputs for)" is to make sure the app definition is not dependent
on the dirvi app constructions. Dirvi constructs the concrete tree and
application APIs from this definition.

The app describes entry content, while dirvi owns its surrounding
presentation: indentation, cursor, selection, fold styling, etc.
Similarly, the app signals when resynchronization is needed, while
dirvi performs it through the shared runtime.

Since apps mean different things, it makes sense to allow registering commands
per app.
