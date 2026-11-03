import type { AppInput } from './app-input.js';

/**
 * API exposing methods at the dirvi shell-level.
 */
export type ShellApi = {
  readonly openApp: (appId: string, input: AppInput) => Promise<void>;
  readonly quit: () => void;
};
