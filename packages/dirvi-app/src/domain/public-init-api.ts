import { AppPackageReference } from './app-pack-ref.js';
import { ConfigPatch } from './config.js';
import { DirviApi } from './dirvi-api/dirvi-api.js';

/**
 * The public API exposed to `init.mjs` as the global `dirvi` object.
 *
 * An {@link InitRuntime} provides this API while the script runs. It describes
 * the intended API for TypeScript consumers and provides editor guidance and
 * compile-time checking. The script uses it to configure Dirvi by evaluation
 * creating {@link Initialization} object used internally by Dirvi.
 *
 * WARNING: Does not validate values at runtime: `init.mjs` may be plain
 * JavaScript and can pass values that do not match these types. The runtime
 * must validate inputs before relying on them.
 */
export type PublicInitApi = {
  readonly options: {
    set: (patch: ConfigPatch) => void;
  };

  readonly app: {
    /**
     * Optionally selects the app initially opened by the shell.
     *
     * If omitted, the runtime falls back to the most recently registered app.
     */
    initial: (appId: string) => void;
    /**
     * Registers an application made available by init.mjs.
     */
    register: (id: string, appReference: AppPackageReference) => void;
  };

  readonly ex: {
    /**
     * Registers an Ex command invoked as `:${name}`.
     *
     * The closure receives the live DirviApi when the user invokes the command,
     * not while init.mjs is being evaluated. E.g.
     *
     * ```js
     * dirvi.ex.register('hello', (api) => {
     *     // Do something with api
     * });
     * ```
     */
    register: (
      name: string,
      execute: (api: DirviApi) => void | Promise<void>,
    ) => void;
  };
};
