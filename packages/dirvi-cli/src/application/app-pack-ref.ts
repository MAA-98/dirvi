export type NpmAppReference = {
  readonly source: 'npm';
  readonly packageName: string;
  readonly version: string;
};

export type AppPackageReference = NpmAppReference;

/**
 * Parses and validates an app package reference supplied by init.mjs.
 *
 * init.mjs is runtime JavaScript, so TypeScript's AppPackageReference type is
 * not sufficient to establish that a received value is safe to interpret as an
 * npm package reference.
 */
export const AppPackageReference = {
  parse(input: unknown): AppPackageReference {
    if (!isRecord(input)) {
      throw new Error('Dirvi app package reference must be an object.');
    }
    
    if (input.source !== 'npm') {
      throw new Error(
        `Unsupported Dirvi app package source "${String(input.source)}".`,
      );
    }
    
    if (typeof input.packageName !== 'string') {
      throw new Error('Dirvi npm app package name must be a string.');
    }
    
    if (
      !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(
        input.packageName,
      )
    ) {
      throw new Error(
        `Invalid npm package name "${input.packageName}" for a Dirvi app.`,
      );
    }
    
    if (typeof input.version !== 'string') {
      throw new Error(
        `Dirvi app package "${input.packageName}" version must be a string.`,
      );
    }
    
    if (
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
        input.version,
      )
    ) {
      throw new Error(
        `Dirvi app package "${input.packageName}" must use an exact version.`,
      );
    }
    
    return {
      source: 'npm',
      packageName: input.packageName,
      version: input.version,
    };
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}