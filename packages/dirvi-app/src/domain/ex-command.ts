import { DirviApi } from 'dirvi-apis';

/**
 * A command registered by init.mjs and invoked through Ex mode.
 */
export type ExCommand = {
  readonly name: string;
  readonly execute: (api: DirviApi, rawArgs: string | undefined) => void | Promise<void>;
};
