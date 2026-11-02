import type { AppInput } from './app-input.js';

export type ShellApi = {
  readonly openApp: (appId: string, input: AppInput) => Promise<void>;
};
