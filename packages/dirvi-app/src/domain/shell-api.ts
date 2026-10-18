import type { AppInput } from './initialization.js';

export type ShellApi = {
  readonly openApp: (appId: string, input: AppInput) => Promise<void>;
};
