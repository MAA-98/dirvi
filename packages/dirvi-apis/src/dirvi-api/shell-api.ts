import type { AppInput } from './app-input.js';
import type { BufferEncoding } from './buffer-encoding.js';

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
  /** Lists all app IDs registered in initialization. */
  readonly listApps: () => string[];
  
  /**
   * Loads an app by ID and input.
   *
   * A successful `loaded` result means the app's methods have been prepared and
   * the shell update was scheduled. App initialization may still fail if the
   * app definition methods fail.
   *
   * @param appId - ID of the registered app to load.
   * @param input - Input to be interpreted by the selected app.
   * @returns A result describing whether the app was loaded or why loading
   * failed. Loading failures do not cause the promise to throw.
   */
  readonly loadApp: (appId: string, input: AppInput) => Promise<OpenAppResult>;

  /** Stdout write handle, copies Node's process.atdout.write signature. */
  readonly stdout?: (
    str: Uint8Array | string,
    encoding?: BufferEncoding,
    cb?: (err?: Error | null) => void,
  ) => boolean;
  
  /** Optional exit message to display. */
  readonly quit: (message?: string) => void;
};
