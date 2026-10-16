import { AppPlugin } from 'dirvi-apis';

import { AppPackageReference } from './app-pack-ref.js';
import { Config, ConfigPatch } from './config.js';
import { App } from './app.js';

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
    install: (reference: AppPackageReference) => Promise<AppPlugin>;
    /**
     * Registers an application made available by init.mjs.
     */
    register: (id: string, appPlugin: AppPlugin) => void;
    /**
     * Optionally selects the app initially opened by the shell.
     *
     * If omitted, the runtime falls back to the most recently registered app.
     */
    initialAppId: (appId: string) => void;
  };
};

/**
 * Everything registered while init.mjs was evaluated.
 *
 * Config is shared tree-UI configuration. App selection is distinct from Config
 * value. initialAppId is always the ID of one app in apps: either the app
 * explicitly selected by init.mjs or the most recently registered app.
 */
export type Init = {
  readonly config: Config;
  readonly apps: readonly App[];
  readonly initialAppId: string;
};
