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
  NameEquals,
  NavNodeApi,
  StateApi,
  TreeNode,
  TreeNodeApi,
} from 'dirvi-lib';

export type AppApi<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  /**
   * Name displayed to distinguish apps.
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
  loadBranches: (path: Name[]) => Promise<BufferNode[]>;

  /**
   * Subscribes to external data changes that require the tree state
   * to be loaded again.
   *
   * Returns an unsubscribe function.
   */
  subscribeToResync: (listener: () => void) => () => void;

  treeNodeApi: TreeNodeApi<Name, BufferNode>;

  /**
   * Structural fold-tree traversal and immutable path updates.
   */
  foldNodeApi: FoldNodeApi<Name>;

  /**
   * Semantic fold operations, including creating an empty fold root and
   * adding, removing, or clearing folded entry names.
   */
  foldNodeService: FoldNodeService<Name>;

  cursorApi: CursorApi<Name>;

  stateApi: StateApi<Name, BufferNode>;

  navNodeApi: NavNodeApi<Name, BufferNode>;
};

export function createAppApis<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  nameEquals: NameEquals<Name>,
): {
  treeNodeApi: TreeNodeApi<Name, BufferNode>;
  foldNodeApi: FoldNodeApi<Name>;
  foldNodeService: FoldNodeService<Name>;
  cursorApi: CursorApi<Name>;
  stateApi: StateApi<Name, BufferNode>;
  navNodeApi: NavNodeApi<Name, BufferNode>;
} {
  const treeNodeApi = createTreeNodeApi<Name, BufferNode>(nameEquals);

  const foldNodeApi = createFoldNodeApi<Name>(nameEquals);

  const foldNodeService = createFoldNodeService(foldNodeApi, (name) => ({
    name,
    branches: [],
    folds: new Set<Name>(),
  }));

  const cursorApi = createCursorApi<Name>(nameEquals);

  const navNodeApi = createNavNodeApi<Name, BufferNode>(
    treeNodeApi,
    foldNodeApi,
    cursorApi,
    nameEquals,
  );

  const stateApi = createStateApi<Name, BufferNode>(
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
