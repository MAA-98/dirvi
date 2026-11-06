import type { AppPackageReference } from 'dirvi-apis';
import type { AppPlugin } from 'dirvi-apis';

/**
 * In the future will be expanded to load other plugins too.
 */
export type PackageLoader = {
  loadAppPlugin: (reference: AppPackageReference) => Promise<AppPlugin>;
};
