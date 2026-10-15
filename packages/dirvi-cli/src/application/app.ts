import type { AppApiApplicator, AppPlugin } from 'dirvi-apis';

/**
 * Unique symbol used as computed property name.
 *
 * DO NOT EXPORT: Meant to be private to the file, so `App` has opaque
 * `AppPlugin`.
 */
const appPlugin = Symbol('appPlugin');

export type App = {
  /**
   * User-owned identifier from init.mjs.
   *
   * This is intentionally not package-owned plugin metadata. It identifies a
   * configured app instance, so users can register the same plugin more than
   * once under different IDs.
   */
  readonly id: string;

  /**
   * Opaque storage for the plugin implementation.
   *
   * Consumers can inspect the configured app ID, but only this module can
   * obtain and invoke the underlying AppPlugin.
   */
  readonly [appPlugin]: AppPlugin;
};

/**
 * Creates one configured app instance from a user-selected ID and a plugin.
 */
export function createApp(id: string, plugin: AppPlugin): App {
  return {
    id,
    [appPlugin]: plugin,
  };
}

/**
 * Creates the app API applicator for a configured app without exposing the
 * `AppPlugin`.
 *
 * The concrete AppApi generic parameters remain owned by the plugin.
 */
export function createAppApiApplicator(
  app: App,
  input: string | undefined,
): AppApiApplicator {
  return app[appPlugin].createAppApiApplicator(input);
}
