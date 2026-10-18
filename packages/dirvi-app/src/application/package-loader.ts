import type { AppPackageReference } from '../domain/app-pack-ref.js';
import type { AppPlugin2 } from 'dirvi-apis';

/**
 * In the future will be expanded to load other plugins too.
 */
export type PackageLoader = {
  loadAppPlugin: (reference: AppPackageReference) => Promise<AppPlugin2>;
};
