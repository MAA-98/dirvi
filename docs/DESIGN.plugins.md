# Design Choices: Plugin Applications

This is a record of design decisions and their justifications. Previous design choices influence the next, so this is
to be interpreted chronologically.

## Extensible configurations

**Requirement:**

1. Like Neovim, the configuration of `dirvi` should be scriptable to allow increasing customization.
2. Even though TS/JS is used instead of Lua, the setup and behavior should closely resemble that of Neovim to make it as
easy to pick as possible.

**Implications:**

TODO

## Applications are plugins rather than CLI features

**Requirement:**

1. `dirvi` should be able to browse more than POSIX filesystem trees.
2. A tree application may have its own domain types, infrastructure, persistence,
   loading behaviour, and interpretation of startup input.
3. The terminal CLI is only one possible host. Future hosts may include native
   desktop applications or other frontends.
4. Application authors must not depend on the private implementation details of
   one particular host.

**Implications:**

The original POSIX filesystem implementation lived within `dirvi-cli`. That is
appropriate while it is the only application, but it makes the following
assumption:

```txt
dirvi-cli = dirvi application
```

This becomes incorrect once there are multiple applications or multiple hosts.

The application must instead be a value supplied to a host through a public
contract:

```txt
dirvi-cli
  └─ loads an application plugin

posix-fs-dirvi-app
  └─ implements the application plugin contract
```

The host owns terminal integration and general UI composition. The application
owns its domain-specific tree and creates its own `AppApi`.

**_Decision:_**

An application is a plugin represented by the public `App` type from
`dirvi-apis`:

```ts
export type App = {
  readonly id: string;
  readonly createAppApiCombinator: (
    input: string | undefined,
  ) => AppApiCombinator;
};
```

The POSIX filesystem application is therefore an independently buildable and
publishable package:

```txt
@mak-98/posix-fs-dirvi-app
```

It is intentionally located outside the monorepo's core `packages/` directory:

```txt
packages/
  dirvi-lib/
  dirvi-apis/
  dirvi-cli/

plugins/
  posix-fs-app/
```

This arrangement makes its dependency direction match that of an external
third-party plugin:

```txt
posix-fs-dirvi-app
  ├─ depends on dirvi-lib
  └─ depends on dirvi-apis

dirvi-cli
  ├─ depends on dirvi-lib
  └─ depends on dirvi-apis
```

In particular, a plugin must not depend on `dirvi-cli`.

## Separate public APIs from hosts and implementations

**Requirement:**

1. Plugin authors need stable types for implementing applications.
2. Configuration authors need a small supported scripting API.
3. `dirvi-cli` must not become the public SDK merely because it is currently
   the first host.
4. `dirvi-lib` should remain focused on generic tree and application machinery,
   rather than host composition and package installation.

**Implications:**

Exporting plugin types from `dirvi-cli` would make external plugins depend on
the terminal host. This would prevent another host, such as a future
`dirvi-macos`, from using the same application contract without also depending
on CLI implementation details.

Putting plugin composition concepts directly in `dirvi-lib` would also conflate
two concerns:

```txt
dirvi-lib
  → generic tree and state machinery

plugin API
  → host/application composition contract
```

The public contract should have one authoritative definition. Duplicating it in
each host would allow API drift.

**_Decision:_**

Create the `dirvi-apis` package as the public extension boundary:

```txt
dirvi-apis
  ├─ plugin API
  ├─ configuration API
  └─ selected re-exports of generic public types
```

The package currently re-exports the `AppApi` and `SerializableKey` types
needed to express the plugin contract:

```ts
export type { AppApi, SerializableKey } from 'dirvi-lib';
```

`dirvi-apis` may depend on `dirvi-lib`, but `dirvi-lib` must not depend on
`dirvi-apis`. This preserves an acyclic dependency direction:

```txt
dirvi-lib
  ↑
dirvi-apis
  ↑        ↑
dirvi-cli  application plugins
```

`dirvi-apis` is deliberately small. It should expose contracts that plugin and
configuration authors are meant to use, but not host internals such as:

```txt
Shell
AppSetup
Ink
React
Node package installation
Node filesystem adapters
CLI argument parsing
```

## Preserve concrete app types behind an existential boundary

**Requirement:**

1. Every application may use different concrete types for node IDs, node
   values, and view keys.
2. The host must be able to mount any valid application without knowing those
   concrete types.
3. Type safety must be preserved: an application's `AppApi` generic arguments
   must remain coherent rather than being erased to `any`.

For example, the POSIX app creates an API approximately of this form:

```ts
AppApi<PosixName, PosixEntry, UnixAbsolutePath>
```

A different application may create:

```ts
AppApi<GitObjectId, GitEntry, RepositoryPath>
```

The shell cannot select one fixed set of generic arguments for all possible
applications.

**Implications:**

A plugin API such as this leaks the application's generic parameters into the
host:

```ts
type App = {
  readonly createAppApi: () => AppApi<Id, Value, ViewKey>;
};
```

The host does not know what `Id`, `Value`, and `ViewKey` should be.

Erasing those types would be possible but unsound:

```ts
AppApi<any, any, any>
```

or:

```ts
AppApi<unknown, unknown, unknown>
```

Both approaches discard the relationships that make the generic tree API safe.

**_Decision:_**

An app supplies an `AppApiCombinator` instead:

```ts
export type AppApiCombinator = <Result>(
  appApiConsumer: AppApiConsumer<Result>,
) => Result;

export type AppApiConsumer<Result> =
  <Id extends SerializableKey, Value, ViewKey = string>(
    appApi: AppApi<Id, Value, ViewKey>,
  ) => Result;
```

The app chooses its concrete generic parameters. The host supplies an operation
that can consume an `AppApi` with any valid coherent parameters.

Conceptually:

```txt
application
  └─ has AppApi<ConcreteId, ConcreteValue, ConcreteViewKey>

host
  └─ does not know the concrete types

AppApiCombinator
  └─ lets the host consume the coherent concrete API
```

The POSIX plugin implements this by creating its concrete API and handing it to
the supplied consumer:

```ts
createAppApiCombinator: (input) => {
  const appApi = loadNodePosixAppApi(input);

  return (appApiConsumer) => appApiConsumer(appApi);
};
```

This is an existential-style boundary: the plugin hides the concrete type
arguments, while the host retains the ability to perform operations valid for
every `AppApi`.

## The shell persists while applications may change

**Requirement:**

1. The terminal host should eventually support changing applications without
   recreating shell-level UI and state.
2. Shell-level concerns should remain independent of a particular application.
3. App-specific setup should receive the concrete `AppApi`.

**Implications:**

Making `Shell` generic over an application's `Id`, `Value`, and `ViewKey`
would incorrectly make the persistent shell depend on the current app's
concrete type.

That would model the application as the outermost UI owner:

```txt
App<Id, Value, ViewKey>
  └─ Shell<Id, Value, ViewKey>
```

It does not model a shell that can later replace one active application with
another application of different types.

**_Decision:_**

`Shell` remains non-generic and accepts the type-erased but type-safe
`AppApiCombinator`:

```ts
type ShellAppProps = {
  readonly config: Config;
  readonly appApiCombinator: AppApiCombinator;
  // shell-level callbacks and dependencies
};
```

`Shell` invokes the combinator when it renders `AppSetup`:

```tsx
return appApiCombinator((appApi) => (
  <AppSetup
    loadedConfig={config}
    appApi={appApi}
    // shell-provided callbacks
  />
));
```

The division of responsibility is:

```txt
Shell
  ├─ active application selection
  ├─ future app switching
  ├─ terminal and host integration
  ├─ global commands and feedback
  ├─ clipboard and stdout integration
  └─ shell lifetime

AppSetup
  ├─ concrete AppApi<Id, Value, ViewKey>
  ├─ app-specific setup
  ├─ app subscriptions
  └─ generic tree UI mounted for one application
```

When application switching is added, `Shell` can replace its current
`AppApiCombinator` while remaining mounted. The replaced `AppSetup` subtree
will unmount, while shell-level state can remain intact.

## Startup input belongs to the host and is interpreted by the app

**Requirement:**

1. The CLI needs to provide a startup value, such as a directory argument.
2. Different applications may interpret startup data differently.
3. The plugin API should not bake POSIX filesystem concepts into all
   applications.

**Implications:**

A plugin API such as:

```ts
open: (input: { readonly directory?: string }) => ...
```

makes a POSIX directory a universal application concept. This would be wrong
for applications that open repositories, remote resources, ASTs, databases, or
other tree structures.

A future desktop host may also obtain startup state differently from a CLI.

**_Decision:_**

The current public application contract accepts an optional host-neutral string:

```ts
createAppApiCombinator: (
  input: string | undefined,
) => AppApiCombinator;
```

The CLI provides it using:

```txt
dirvi --input <value>
```

The selected application interprets the value. The POSIX filesystem application
currently interprets it as an optional directory path.

This is intentionally a small first contract. It may later evolve into a more
structured host-neutral startup input once multiple app kinds establish common
requirements.

## init.mjs composes applications explicitly

**Requirement:**

1. Users should choose which applications are installed and available.
2. Users should choose the application opened at startup.
3. Startup configuration must not expose arbitrary host internals.
4. Application registration should be collected while configuration is
   evaluated and then sealed before the UI starts.

**Implications:**

The init script needs a narrow API for three related operations:

```txt
install an application package
register an application value
select the startup application
```

Installation and registration are distinct. An installed package is available
for loading, but it does not become part of the current session until the
script registers the resulting `App`.

Similarly, selecting an application is distinct from registering it.

**_Decision:_**

`init.mjs` receives an `InitApi` as `globalThis.dirvi`. Its application
namespace has the shape:

```ts
type InitApi = {
  readonly apps: {
    install: (reference: AppPackageReference) => Promise<App>;
    use: (app: App) => void;
    startupApp: (appId: string) => void;
  };
};
```

A configuration script therefore composes startup explicitly:

```js
const posixApp = await globalThis.dirvi.apps.install({
  packageName: '@mak-98/posix-fs-dirvi-app',
  version: '0.11.0-beta.1',
});

globalThis.dirvi.apps.use(posixApp);
globalThis.dirvi.apps.startupApp(posixApp.id);
```

The init runtime accumulates the registrations and returns:

```ts
type Init = {
  readonly config: Config;
  readonly apps: readonly App[];
  readonly initialAppId: string;
};
```

The CLI then finds the selected application, creates its
`AppApiCombinator`, and provides that combinator to `Shell`.

The init runtime validates at least these invariants:

1. app IDs must not be empty;
2. the same app ID cannot be registered twice;
3. configuration cannot be modified after initialization finishes;
4. applications cannot be registered after initialization finishes;
5. the selected startup app must be registered before startup proceeds.

## Install packages remotely, load code locally

**Requirement:**

1. An application package should be publishable to npm and usable by the CLI
   without being a local workspace dependency.
2. App versions should be explicit and reproducible.
3. The CLI should not fetch a JavaScript URL and evaluate it directly on every
   startup.
4. Installed apps and their dependencies should not become dependencies of
   `dirvi-cli` itself.

**Implications:**

Direct network imports would leave package dependency resolution, caching,
version pinning, offline launches, package integrity, updates, and rollback
undefined.

Making each installed app a dependency of `dirvi-cli` would make the host own
all user-selected applications and would prevent normal third-party extension.

The appropriate model is similar to optional package locations in Neovim:

```txt
remote registry
  → explicit installation
  → local managed package directory
  → explicit loading during startup
```

**_Decision:_**

The Node CLI installs npm applications into a Dirvi-owned data directory:

```txt
<dirvi data directory>/
  site/
    pack/
      apps/
        opt/
          npm/
            <package-specific directory>/
              package.json
              package-lock.json
              node_modules/
```

For example, a package named:

```txt
@mak-98/posix-fs-dirvi-app
```

receives a directory name derived from its package name:

```txt
mak-98__posix-fs-dirvi-app
```

Each installed application has an independent npm project. This allows Node to
resolve the plugin package and its transitive dependencies relative to the
installed package store, without modifying the CLI's own dependency graph.

The initial installer accepts only exact npm versions:

```ts
type AppPackageReference = {
  readonly packageName: string;
  readonly version: string;
};
```

For example:

```js
{
  packageName: '@mak-98/posix-fs-dirvi-app',
  version: '0.11.0-beta.1',
}
```

Version ranges, `latest`, Git references, URLs, aliases, and local paths are
not part of the initial public installer contract.

## Application packages default-export one app

**Requirement:**

1. The host needs an unambiguous entrypoint after installing a package.
2. The installer must validate package code at the runtime trust boundary.
3. Plugin authors should have a small package convention.

**Implications:**

TypeScript conformance disappears after a package is published. Although an
author writes:

```ts
const posixAppPlugin: App = {
  // ...
};
```

the host receives JavaScript at runtime and must not assume it is valid.

Making the host guess an arbitrary named export would make package loading
ambiguous.

**_Decision:_**

A package intended to provide one Dirvi app default-exports its `App` value:

```ts
export { posixAppPlugin as default } from './posix-fs-dirvi-app.js';
export { posixAppPlugin } from './posix-fs-dirvi-app.js';
```

The installer resolves the installed package from its own package directory,
imports the resolved module locally, and reads:

```ts
loadedModule.default
```

The host then checks the minimum runtime application shape:

```txt
app is an object
app.id is a non-empty string
app.createAppApiCombinator is a function
```

A package which fails this check produces a startup error rather than being
accepted based only on compile-time assumptions made by its author.

The default export convention is intentionally limited to one application per
package for now. If packages later need to provide multiple applications, a
deliberate multi-app export convention should be designed rather than inferred
from arbitrary module exports.

## The POSIX app remains independently owned

**Requirement:**

1. The existing POSIX filesystem browser must continue to work while becoming
   an external application.
2. POSIX-specific domain and infrastructure code must not remain an implicit
   requirement of every Dirvi host.
3. The transition should avoid deleting the known-working hard-coded path
   before plugin startup has proven itself.

**_Decision:_**

The POSIX filesystem app is copied into the standalone plugin package first.
It owns:

```txt
POSIX entry names
POSIX file, symlink, and directory semantics
Unix path validation
filesystem loading
filesystem watching
POSIX view persistence
construction of the POSIX AppApi
```

The plugin package exports an `App` whose implementation constructs the
concrete POSIX application API:

```ts
export const posixAppPlugin: App = {
  id: 'posix',

  createAppApiCombinator: (input) => {
    const appApi = loadNodePosixAppApi(input);

    return (appApiConsumer) => appApiConsumer(appApi);
  },
};
```

The previous CLI-local POSIX implementation may remain temporarily as an
unused migration reference. It should not be used by normal startup once the
published plugin has been installed and selected through `init.mjs`.

The eventual desired direction is:

```txt
dirvi-cli
  → generic host and shell

@mak-98/posix-fs-dirvi-app
  → POSIX filesystem application

init.mjs
  → selects the POSIX app, or another installed app
```

## Future work

The current system establishes the minimum viable application boundary. It does
not yet decide the following:

1. app switching UI and lifecycle;
2. opening multiple app instances simultaneously;
3. workspaces, tabs, or persistent app sessions;
4. structured startup input beyond an optional string;
5. app capabilities and host compatibility declarations;
6. package update, uninstall, listing, and rollback commands;
7. lockfile and integrity policy exposed to users;
8. permission or trust controls for installed application code;
9. packages containing multiple independently selectable apps;
10. a stable public configuration API in `dirvi-apis/config`;
11. compatibility and version negotiation between `dirvi-apis`, hosts, and
    app packages.

These should be designed as separate steps. The current decisions establish
the dependency direction and generic application boundary needed for all of
them.