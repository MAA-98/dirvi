import {
  createCursorApi,
  createFoldNodeApi,
  createNavNodeApi,
  createStateApi,
  createTreeNodeApi,
  CursorApi,
  FoldNodeApi,
  LoadBranches,
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
   * Name displayed to distinguish apps
   */
  name: string;
  /**
   * Message displayed when the entries are empty and
   * there's nothing to display.
   */
  emptyForestMessage: string;

  /**
   * Loads the children of the branch at `path`.
   *
   * The empty path represents the root branch.
   */
  loadBranches: LoadBranches<Name, BufferNode>;

  /**
   * Subscribes to external data changes that require the tree state
   * to be loaded again.
   *
   * Returns an unsubscribe function.
   */
  subscribeToResync: (listener: () => void) => () => void;

  treeNodeApi: TreeNodeApi<Name, BufferNode>;

  foldNodeApi: FoldNodeApi<Name, BufferNode>;

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
  foldNodeApi: FoldNodeApi<Name, BufferNode>;
  cursorApi: CursorApi<Name>;
  stateApi: StateApi<Name, BufferNode>;
  navNodeApi: NavNodeApi<Name, BufferNode>;
} {
  const treeNodeApi = createTreeNodeApi<Name, BufferNode>(nameEquals);
  const foldNodeApi = createFoldNodeApi<Name, BufferNode>(nameEquals);
  const cursorApi = createCursorApi<Name>(nameEquals);
  const navNodeApi = createNavNodeApi<Name, BufferNode>(
    treeNodeApi,
    foldNodeApi,
    cursorApi,
    nameEquals,
  );
  const stateApi = createStateApi<Name, BufferNode>(treeNodeApi, foldNodeApi, cursorApi, navNodeApi);

  return {
    treeNodeApi,
    foldNodeApi,
    cursorApi,
    stateApi,
    navNodeApi,
  };
}
