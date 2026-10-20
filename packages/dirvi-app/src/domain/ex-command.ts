import { ShellApi } from './shell-api.js';

export type DirviApi = {
  shell: ShellApi;
}

// TODO Later: Add arguments
/**
 * A command registered by init.mjs and invoked through Ex mode.
 *
 * The command receives the live Api only when it is executed. This keeps
 * initialization separate from the running application lifecycle.
 */
export type ExCommand = {
  readonly name: string;
  readonly execute: (api: DirviApi) => void | Promise<void>;
};
