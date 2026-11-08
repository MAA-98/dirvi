import type { AppDefinition } from './app-definition.js';
import type { SerializableKey } from './key.js';

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
