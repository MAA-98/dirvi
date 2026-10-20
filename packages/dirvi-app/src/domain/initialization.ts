import { Config } from './config.js';
import { ExCommand } from './ex-command.js';
import { AppPackageReference } from './app-pack-ref.js';

export type AppInput = string | undefined;

/**
 * Object set through initialization, i.e. evaluating init.mjs.
 *
 * Config is shared tree-UI configuration. App selection is distinct from Config
 * value. Ex commands are executable startup registrations and are therefore
 * stored separately from Config.
 *
 * initialAppId is always the ID of one app in apps: either the app explicitly
 * selected by init.mjs or the most recently registered app.
 */
export type Initialization = {
  readonly config: Readonly<Config>;
  readonly app: {
    initial: string;
    registered: ReadonlyMap<string, AppPackageReference>;
  };
  readonly exCommands: readonly ExCommand[];
};
