import type { ViewApi } from './view-api.js';
import type {
  BranchTreeNode,
  CursorApi,
  FoldNode,
  FoldNodeApi,
  FoldNodeService,
  NavNodeApi,
  SerializableKey,
  State,
  StateApi,
  TreeNode,
  TreeNodeApi,
} from '../tree-surfer/index.js';
import {
  createCursorApi,
  createFoldNodeService,
  createNavNodeApi,
  createStateApi,
  createTreeNodeApi,
} from '../tree-surfer/index.js';

export type AppApi<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
  ViewKey = string,
> = {
  /**
   * Name used to distinguish the app, e.g. 'posix' for POSIX directory app.
   */
  appId: string;

  /**
   * Name to distinguish app instance.
   */
  name: string;
  rootId: Id;

  loadBranches: (path: Id[]) => Promise<Node[]>;
  createRoot: () => Promise<Node & BranchTreeNode<Id, Node>>;

  /**
   * Subscribes to external data changes that require the tree state
   * to be loaded again.
   *
   * Returns an unsubscribe function.
   */
  subscribeToResync: (listener: () => void) => () => void;

  treeNodeApi: TreeNodeApi<Id, Node>;
  foldNodeApi: FoldNodeApi<Id>;
  foldNodeService: FoldNodeService<Id>;
  cursorApi: CursorApi<Id>;
  stateApi: StateApi<Id, Node>;
  navNodeApi: NavNodeApi<Id, Node>;

  viewKey: ViewKey;
  viewApi: ViewApi<State<Id, Node>, ViewKey>;
};

export function createAppApis<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(): {
  treeNodeApi: TreeNodeApi<Id, BufferNode>;
  foldNodeApi: FoldNodeApi<Id>;
  foldNodeService: FoldNodeService<Id>;
  cursorApi: CursorApi<Id>;
  stateApi: StateApi<Id, BufferNode>;
  navNodeApi: NavNodeApi<Id, BufferNode>;
} {
  const treeNodeApi = createTreeNodeApi<Id, BufferNode>();
  const foldNodeApi = createTreeNodeApi<Id, FoldNode<Id>>();
  const foldNodeService = createFoldNodeService(foldNodeApi);

  const cursorApi = createCursorApi<Id>();

  const navNodeApi = createNavNodeApi<Id, BufferNode>(
    treeNodeApi,
    foldNodeService,
    cursorApi,
  );

  const stateApi = createStateApi<Id, BufferNode>(
    treeNodeApi,
    foldNodeApi,
    cursorApi,
    navNodeApi,
  );

  return {
    treeNodeApi,
    foldNodeApi,
    foldNodeService,
    cursorApi,
    stateApi,
    navNodeApi,
  };
}
