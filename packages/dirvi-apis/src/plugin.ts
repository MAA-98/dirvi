import type { AppApi, SerializableKey } from './imports.js';

/**
 * An app is a plugin for dirvi, which is referred to by its ID.
 *
 * To start the app an optional input string may be provided. This is a
 * host-neutral startup value left to be interpreted by the app.
 */
export type App = {
  readonly id: string;
  readonly createAppApiCombinator: (
    input: string | undefined,
  ) => AppApiCombinator;
};

export type AppApiCombinator = <Result>(
  appApiConsumer: AppApiConsumer<Result>,
) => Result;

/**
 * An operation that can consume an AppApi of any valid concrete type and
 * produce a caller-selected result.
 */
export type AppApiConsumer<Result> = <
  Id extends SerializableKey,
  Value,
  ViewKey = string,
>(
  appApi: AppApi<Id, Value, ViewKey>,
) => Result;
