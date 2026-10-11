import type { AppPlugin } from './app-plugin.js';
import type { AppPackageReference } from './app-pack-ref.js';

/**
 * Installs, resolves, and loads an app package for this host.
 *
 * The implementation belongs to infrastructure because it may use npm, the
 * filesystem, and Node module loading.
 */
export type AppPackageInstaller = {
  readonly install: (reference: AppPackageReference) => Promise<AppPlugin>;
};
