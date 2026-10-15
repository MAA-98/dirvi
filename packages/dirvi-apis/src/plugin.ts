import type { AppApi, SerializableKey } from './imports.js';

/**
 * App plugin for dirvi, creates the app api and exposes it with an applicator.
 *
 * To start the app an optional input string may be provided. This is a
 * host-neutral startup value left to be interpreted by the app.
 */
export type AppPlugin = {
  readonly createAppApiApplicator: (
    input: string | undefined,
  ) => AppApiApplicator;
};

/**
 * Creates and applies the AppApi to a given consumer of it.
 */
export type AppApiApplicator = <Result>(
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
