import { Config } from '../domain/config.js';

export type ConfigApi = {
  load: () => Promise<Config>;
  save: (config: Config) => Promise<void>;
  subscribeToResync: (listener: () => void) => () => void;
};
