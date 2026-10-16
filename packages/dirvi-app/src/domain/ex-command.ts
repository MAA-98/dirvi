// TODO Later: Add arguments
import { ShellApi } from './shell-api.js';

/**
 * A command registered by init.mjs and invoked through Ex mode.
 *
 * The command receives the live DirviApi only when it is executed. This keeps
 * initialization separate from the running application lifecycle.
 */
export type ExCommand = {
  readonly name: string;
  readonly execute: (shell: ShellApi) => void | Promise<void>;
};
