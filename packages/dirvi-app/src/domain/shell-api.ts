import type { AppInput } from './app.js';

export type ShellApi = {
  readonly openApp: (appId: string, input: AppInput) => Promise<void>;
};
