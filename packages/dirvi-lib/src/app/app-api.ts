import type {
  NavMethods,
  SerializableKey,
  StateApi,
} from '../state-and-nav/index.js';
import type { PresentNode } from './node-presentation.js';
import { TreeNode } from '../state-and-nav/index.js';

/**
 * Application-specific tree dependencies and operations.
 *
 * This is currently migrated through the generic TreeNode and State APIs.
 * Navigation-specific APIs remain outside this type until NavNodeApi has been
 * migrated from the old structural TreeNode API.
 *
 * @typeParam Id - The sibling-unique tree-node ID type.
 * @typeParam Value - Application-owned data stored in each tree node.
 * @typeParam ViewKey - The key used to identify view implementations.
 */
export type AppApi<
  Id extends SerializableKey,
  Value,
  ViewKey = string,
> = Readonly<{
  /**
   * Name used to distinguish a particular application instance.
   */
  name: string;

  /**
   * ID used for the application's root node.
   */
  rootId: Id;

  /**
   * Loads direct children for the branch addressed by `path`.
   *
   * Returned nodes must be opaque tree values created or decoded through this
   * application's TreeNodeApi specialization.
   */
  loadBranches: (
    path: readonly Id[],
  ) => Promise<readonly TreeNode<Id, Value>[]>;

  /**
   * Creates the application's root node.
   *
   * Invariant: the returned node is an open branch. That invariant is checked
   * when an initial State is created.
   */
  createRoot: () => Promise<TreeNode<Id, Value>>;
  
  presentNode: PresentNode<Id>;

  /**
   * Subscribes to external data changes that require tree state to be loaded
   * again.
   *
   * Returns an unsubscribe function.
   */
  subscribeToResync: (listener: () => void) => () => void;

  stateApi: StateApi<Id, Value>;

  /**
   * UI navigation projection and cursor-navigation operations.
   */
  navMethods: NavMethods<Id, Value>;
}>;
