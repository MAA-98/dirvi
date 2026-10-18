import type { ZodType } from 'zod';
import type { AppApi, SerializableKey } from './imports.js';
import type { CreateNavNodeApiOptions, TreeNode } from 'dirvi-lib';

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

// PLAN:

export type AppPlugin2 = {
  readonly createAppDefinitionApplicator: (
    input: string | undefined,
  ) => AppDefinitionApplicator;
};

/**
 * The needed information for creating an `AppApi`. TODO
 */
export type AppDefinition<Id extends SerializableKey, Value> = Readonly<{
  /**
   * User-facing application name shown by the host.
   */
  readonly displayName: string;

  /**
   * Useful at times.
   */
  readonly rootId: Id;

  /**
   * Validates application tree node data.
   */
  readonly idSchema: ZodType<Id>;
  readonly valueSchema: ZodType<Value>;

  /**
   * Creates the application's root node.
   *
   * Invariant: the returned node is an open branch. That invariant is checked
   * when an initial State is created.
   */
  readonly createRoot: () => Promise<TreeNode<Id, Value>>;

  /**
   * Loads direct children for the branch addressed by `path`.
   *
   * Returned nodes must be opaque tree values created or decoded through this
   * application's TreeNodeApi specialization.
   */
  readonly loadChildren: (path: readonly Id[]) => Promise<readonly TreeNode<Id, Value>[]>;
  
  /**
   * Listener for when to reload to add or remove new children in loaded
   * branches.
   */
  readonly subscribeToResync: ((listener: () => void) => () => void);
  
  readonly createNavNodeApiOptions: CreateNavNodeApiOptions<Id, Value>;
}>;

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
export type AppDefinitionConsumer<Result> = <
  Id extends SerializableKey,
  Value,
>(appDefinition: AppDefinition<Id, Value>) => Result;
