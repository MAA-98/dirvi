import { Config } from './config.js';
import { ExCommand } from './ex-command.js';
import { AppPackageReference } from './app-pack-ref.js';

/**
 * Resolved startup state produced by evaluating `init.mjs`.
 *
 * The initialization script runs before the terminal UI starts. It uses the
 * temporary `dirvi` configuration facade to set shared options, register app
 * packages, choose the initial app, and register Ex commands.
 */
export type Initialization = {
  /** Dirvi-wide configuration resolved from the initialization script. */
  readonly config: Readonly<Config>;
  
  /** Registered apps and the app selected for startup. */
  readonly app: {
    /** ID of the app to open initially; must be present in `registered`. */
    initial: string;
    
    /** App package references keyed by app ID. */
    registered: ReadonlyMap<string, AppPackageReference>;
  };
  
  /** Ex commands registered by the initialization script, keyed by name. */
  readonly exCommands: ReadonlyMap<string, ExCommand>;
};
