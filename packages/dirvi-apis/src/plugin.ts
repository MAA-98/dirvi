import type { AppApi, SerializableKey } from './imports.js';

export type AppApiRenderer<Result> = {
  readonly render: <Id extends SerializableKey, Value, ViewKey = string>(
    appApi: AppApi<Id, Value, ViewKey>,
  ) => Result;
};

export type OpenApp = {
  readonly withAppApi: <Result>(renderer: AppApiRenderer<Result>) => Result;
};

export type AppPlugin<Input> = {
  readonly id: string;
  readonly open: (input: Input) => OpenApp;
};
