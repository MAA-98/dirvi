import type { Config } from './config.js';
import type { AppInput } from './app.js';
import type { AppApiApplicator } from 'dirvi-apis';

/**
 * The configured, long-lived Dirvi application API.
 *
 * This is created after init.mjs has finished evaluating. Unlike PublicInitApi,
 * it cannot install packages or register apps: startup composition is sealed.
 */
export type DirviApi = {
  readonly config: Config;
  readonly initialAppId: string;
  readonly appIds: readonly string[];

  /**
   * Opens a registered app using host-provided startup input.
   *
   * The returned applicator preserves the concrete AppApi generic parameters
   * selected by the app plugin without exposing them to the host or Shell.
   */
  readonly openApp: (appId: string, input: AppInput) => AppApiApplicator;
};
