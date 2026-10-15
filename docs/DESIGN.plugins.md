# Design Choices: Config and Plugins

This is a record of design decisions and their justifications. Previous design
choices influence the next, so this is to be interpreted chronologically.

## Extensible configs

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
dirvi;
```

The facade is available only while `init.mjs` is being evaluated. It exposes
configuration operations, rather than direct access to the terminal UI,
application state, or host infrastructure.

For example, an initialization script may change shared UI options:

```js
dirvi.options.set({
  indentSize: 4,
  firstIndent: '│ ',
});
```

The startup lifecycle is:

- dirvi starts
- evaluates `init.mjs`
- exposes `globalThis.dirvi`/`dirvi` temporarily
- `init.mjs` changes configuration through the exposed API
- host consumes the resolved configuration
- host enters the terminal UI
