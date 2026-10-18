import type { AppApi, SerializableKey } from './imports.js';
import type { AppDefinition } from './app-definition.js';

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

/**
 * Creates and applies the AppDefinition to a given consumer of it.
 *
 * This is so that host doesn't need the generic types specified.
 */
export type AppDefinitionApplicator = <Result>(
  appDefinitionConsumer: AppDefinitionConsumer<Result>,
) => Result;

/**
 * The function that creates an AppApi from AppDefinition will be the consumer.
 */
export type AppDefinitionConsumer<Result> = <Id extends SerializableKey, Value>(
  appDefinition: AppDefinition<Id, Value>,
) => Result;

export type AppPlugin = {
  readonly createAppDefinitionApplicator: (
    input: string | undefined,
  ) => AppDefinitionApplicator;
};