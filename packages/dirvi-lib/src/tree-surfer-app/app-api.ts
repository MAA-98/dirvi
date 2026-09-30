import type { ViewApi } from './view-api.js';
import type {
  CursorApi,
  FoldNodeService,
  SerializableKey,
  State,
  StateApi,
  TreeNode,
  TreeNodeApi,
} from '../tree-surfer/index.js';
import {
  createCursorApi,
  createStateApi,
  createTreeNodeApi,
} from '../tree-surfer/index.js';

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
   * Name used to distinguish the application, for example `"posix"` for a
   * POSIX-directory application.
   */
  appId: string;

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

  /**
   * Subscribes to external data changes that require tree state to be loaded
   * again.
   *
   * Returns an unsubscribe function.
   */
  subscribeToResync: (listener: () => void) => () => void;

  /**
   * Generic structural operations for this application's buffer tree.
   */
  treeNodeApi: TreeNodeApi<Id, Value>;

  /**
   * Semantic fold-state operations.
   *
   * This remains temporarily available while FoldNode itself is migrated.
   */
  foldNodeService: FoldNodeService<Id>;

  cursorApi: CursorApi<Id>;

  stateApi: StateApi<Id, Value>;

  viewKey: ViewKey;

  viewApi: ViewApi<State<Id, Value>, ViewKey>;
}>;

export type AppStateApis<Id extends SerializableKey, Value> = Readonly<{
  treeNodeApi: TreeNodeApi<Id, Value>;
  cursorApi: CursorApi<Id>;
  stateApi: StateApi<Id, Value>;
}>;

export function createAppStateApis<
  Id extends SerializableKey,
  Value,
>(): AppStateApis<Id, Value> {
  const treeNodeApi = createTreeNodeApi<Id, Value>();
  const cursorApi = createCursorApi<Id>();
  const stateApi = createStateApi<Id, Value>(treeNodeApi, cursorApi);

  return {
    treeNodeApi,
    cursorApi,
    stateApi,
  };
}