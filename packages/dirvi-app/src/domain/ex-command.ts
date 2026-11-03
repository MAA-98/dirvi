import { ShellApi } from './shell-api.js';

export type DirviApi = {
  shell: ShellApi;
}

// TODO Later: Add arguments
/**
 * A command registered by init.mjs and invoked through Ex mode.
 */
export type ExCommand = {
  readonly name: string;
  readonly execute: (api: DirviApi) => void | Promise<void>;
};
