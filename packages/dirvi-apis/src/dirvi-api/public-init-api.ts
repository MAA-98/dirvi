import { AppPackageReference } from '../app-pack-ref.js';
import { DirviApi } from './index.js';
import { ConfigPatch } from './index.js';

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
    register: (app: {
      id: string;
      packRef: AppPackageReference;
      /**
       * Ex commands invoked as `:${command}` while this app is active.
       *
       * Each closure receives the live DirviApi and the unparsed argument text
       * when invoked, not while init.mjs is being evaluated.
       *
       * `rawArgs` is undefined if no additional arguments were given to the
       * command.
       */
      ex?: readonly {
        command: string;
        execute: (api: DirviApi, rawArgs?: string) => void | Promise<void>;
      }[];
    }) => void;
  };
};
