export type NpmAppReference = {
  readonly source: 'npm';
  readonly packageName: string;
  readonly version: string;
};

export type AppPackageReference = NpmAppReference;
