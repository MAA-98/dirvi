import type { AppInput } from '../app-input.js';

export type OpenAppResult =
  | { readonly kind: 'loaded' }
  | {
      readonly kind: 'notRegistered';
      readonly appId: string;
      readonly message: string;
    }
  | {
      readonly kind: 'loadFailed';
      readonly appId: string;
      readonly message: string;
    };

/**
 * API exposing methods at the dirvi shell-level.
 *
 * Not specific to any app.
 */
export type ShellApi = {
  /** Result type, so can be trusted to not throw errors. */
  readonly loadApp: (appId: string, input: AppInput) => Promise<OpenAppResult>;
  
  /** Optional exit message to display. */
  readonly quit: (message?: string) => void;
  
};
