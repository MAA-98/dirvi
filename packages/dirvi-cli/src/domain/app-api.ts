import {
  createCursorApi,
  createFoldNodeApi,
  createFoldNodeService,
  createNavNodeApi,
  createStateApi,
  createTreeNodeApi,
  CursorApi,
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
  BufferNode extends TreeNode<Id, BufferNode>,
  ViewKey = string,
> = {
  /*
   * Name used to distinguish the app.
   */
  appId: string;

  /**
   * Name displayed to distinguish app instance.
   */
  name: string;

  /**
   * Message displayed when the entries are empty and there is nothing
   * to display.
   */
  emptyForestMessage: string;

  /**
   * Loads the children of the branch at `path`.
   *
   * The empty path represents the root branch.
   */
  loadBranches: (path: Id[]) => Promise<BufferNode[]>;

  /**
   * Subscribes to external data changes that require the tree state
   * to be loaded again.
   *
   * Returns an unsubscribe function.
   */
  subscribeToResync: (listener: () => void) => () => void;

  treeNodeApi: TreeNodeApi<Id, BufferNode>;

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

  stateApi: StateApi<Id, BufferNode>;

  navNodeApi: NavNodeApi<Id, BufferNode>;

  viewKey: ViewKey;
  viewApi: ViewApi<State<Id, BufferNode>, ViewKey>;
};

export function createAppApis<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  rootId: Id
): {
  treeNodeApi: TreeNodeApi<Id, BufferNode>;
  foldNodeApi: FoldNodeApi<Id>;
  foldNodeService: FoldNodeService<Id>;
  cursorApi: CursorApi<Id>;
  stateApi: StateApi<Id, BufferNode>;
  navNodeApi: NavNodeApi<Id, BufferNode>;
} {
  const treeNodeApi = createTreeNodeApi<Id, BufferNode>();

  const foldNodeApi = createFoldNodeApi<Id>();

  const foldNodeService = createFoldNodeService(rootId, foldNodeApi, (id) => ({
    id,
    children: [],
    folds: new Set<Id>(),
  }));

  const cursorApi = createCursorApi<Id>();

  const navNodeApi = createNavNodeApi<Id, BufferNode>(
    treeNodeApi,
    foldNodeApi,
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
