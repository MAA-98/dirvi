import {
  BranchTreeNode,
  createCursorApi,
  createFoldNodeService,
  createNavNodeApi,
  createStateApi,
  createTreeNodeApi,
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
} from 'dirvi-lib';
import { ViewApi } from './view-api.js';

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

  /**
   * Message displayed when there are no root children.
   */
  emptyRootMessage: string;

  /**
   * Loads the children of the branch at `path`.
   *
   * The empty path represents the root branch.
   */
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

  /**
   * Structural fold-tree traversal and immutable path updates.
   */
  foldNodeApi: FoldNodeApi<Id>;

  /**
   * Semantic fold operations, including creating an empty fold root and
   * adding, removing, or clearing folded entry names.
   */
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
