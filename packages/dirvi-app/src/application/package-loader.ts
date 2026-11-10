import type {
  AppPackageReference,
  CreateAppDefinitionApplicator,
} from 'dirvi-apis';

/**
 * In the future will be expanded to load other plugins too.
 */
export type PackageLoader = {
  loadAppPlugin: (
    reference: AppPackageReference,
  ) => Promise<CreateAppDefinitionApplicator>;
};
