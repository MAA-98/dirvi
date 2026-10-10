import type { AppApi, SerializableKey } from 'dirvi-lib';

export type AppOpenInput = {
  /**
   * Temporary startup input used by the existing POSIX app.
   *
   * This can become app-specific later, when apps own their own command-line
   * arguments and startup inputs.
   */
  readonly directory?: string;
};

export type AppApiRenderer<Result> = {
  readonly render: <Id extends SerializableKey, Value, ViewKey = string>(
    appApi: AppApi<Id, Value, ViewKey>,
  ) => Result;
};

/**
 * An opened app whose concrete AppApi generic parameters are hidden from the
 * host but remain internally coherent.
 */
export type OpenApp = {
  readonly withAppApi: <Result>(renderer: AppApiRenderer<Result>) => Result;
};

/**
 * A generic tree application available to dirvi.
 *
 * An AppPlugin can open one concrete AppApi<Id, Value, ViewKey>. The shared
 * Shell will eventually render that API through AppSetup.
 */
export type AppPlugin = {
  readonly id: string;
  readonly open: (input: AppOpenInput) => OpenApp;
};
