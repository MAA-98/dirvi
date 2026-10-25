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
```
and can also be accessed with:
```js
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

## App plugins 1

**Requirement:**

1. Support applications for different tree structures, such as filesystems,
   XML, ASTs, and s-expressions.
2. Allow each application to define its own node values, data loading, and
   entry presentation.
3. Keep the tree runtime and interaction behavior within dirvi, rather than
   requiring each application to implement them.
4. Allow the host to run applications without knowing their concrete
   identifier and value types.

**Implications:**

An app plugin needs to connect an application-specific data source to
dirvi's shared tree model.

For example, a filesystem app knows how to read directories, identify
entries, and describe files. An XML app knows how to read and describe
XML nodes. Neither should need to implement its own cursor, fold-state
management, navigation runtime, or terminal UI.

The plugin therefore supplies an application definition, rather than
a replacement tree runtime. Dirvi uses that definition to construct
the application's runtime API.

Applications can use different identifier and value types. These types
must remain consistent within an application, but the host should not
need to name them when selecting or running an app.

**_Decision:_**

An app plugin exposes `createAppDefinitionApplicator`. The definition
supplies at least:

- A function for creating the initial root.
- A function for loading a branch's direct children.
- A synchronous, side-effect-free function for describing a tree node's
  presentation.
- A subscription through which the app can request resynchronization.

Dirvi constructs the concrete tree and application APIs from this
definition. The plugin does not supply implementations of dirvi's
internal tree structures or runtime.

Functions that create or load nodes receive the application's specialized
`TreeMethods`. They must return opaque tree nodes created or decoded
through that API, rather than constructing an alternative node
representation.

The initial root must be an open branch. Dirvi checks this invariant
when constructing the initial state.

The app describes entry content, while dirvi owns its surrounding
presentation: indentation, cursor styling, selection styling, and fold
decorations. Similarly, the app signals when resynchronization is needed,
while dirvi performs it through the shared runtime.

## App plugins 2

**Requirement:**

1. Preserve structural information that is meaningful to the application, 
   in particular whether order is semantically meaningful.
2. Share behavior where possible without forcing different structures into
   the same presentation.

**Implications:**

Whether sibling order is meaningful depends on the underlying structure,
and therefore on the app plugin.

For example, a filesystem app may treat siblings as unordered: sorting
entries differently changes their presentation, not the underlying
structure. This implies keeping folded children inline and ordered within 
the UI presentation adds visual clutter and inefficient controls. E.g. I
don't want to see all folded entries with name alphabetically between two 
files, it's not semantically useful, so in that case move it to the parent 
row. 

On the other hand, in an XML app sibling order determines the document,
so I do want to see the folds inline and be able to interact with a particular
contiguous selection of folds, as in Vim and any other text editors. 

Therefore collecting all hidden children into a summary on their parent is 
appropriate for unordered siblings. For ordered siblings, that would lose 
the position of hidden entries within the sequence and hence should be displayed 
inline.

**_Decision:_**

The app plugin declares whether sibling order is semantically meaningful.

- In an unordered app, sibling order is a presentation choice.
- In an ordered app, sibling order comes from the underlying structure
  and must be preserved by the view.

Dirvi uses this declaration to provide the corresponding fold presentation
and navigation behavior. This is structural information supplied by the
app, rather than merely a cosmetic preference in user configuration.

The first layer that interprets these inputs differently is the
navigation projection. Unordered navigation aggregates hidden children
on their parent, while ordered navigation introduces inline fold
markers as navigable positions.

Therefore two versions of navigation nodes and its API are made, one with 
inline folds as navigable entries and one without.

The app declares ordering semantics, not a concrete navigation
implementation. Dirvi remains responsible for constructing and
integrating the selected navigation system.

This selection does not change the node-tree or fold-state APIs.