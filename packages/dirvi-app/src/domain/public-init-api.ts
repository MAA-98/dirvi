import { AppPackageReference } from './app-pack-ref.js';
import { ConfigPatch } from './config.js';
import { ShellApi } from './shell-api.js';

/**
 * The startup configuration API exposed to init.mjs as the global `dirvi`.
 *
 * This is intentionally a narrow facade. It is the public scripting boundary,
 * rather than an escape hatch into UI state or infrastructure implementations.
 */
export type PublicInitApi = {
  readonly options: {
    set: (patch: ConfigPatch) => void;
  };

  readonly apps: {
    /**
     * Optionally selects the app initially opened by the shell.
     *
     * If omitted, the runtime falls back to the most recently registered app.
     */
    initialAppId: (appId: string) => void;
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
      execute: (shell: ShellApi) => void | Promise<void>,
    ) => void;
  };
};
