import type { AppPlugin as GenericAppPlugin } from 'dirvi-apis/plugin';

export type AppOpenInput = {
  readonly directory?: string;
};

export type AppPlugin = GenericAppPlugin<AppOpenInput>;
