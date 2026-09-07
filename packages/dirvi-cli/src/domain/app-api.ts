import {
  CursorApi,
  FoldNodeApi,
  NavNodeApi,
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
  loadBranches: (path: Name[]) => Promise<BufferNode[]>;

  treeNodeApi: TreeNodeApi<Name, BufferNode>;

  foldNodeApi: FoldNodeApi<Name, BufferNode>;

  cursorApi: CursorApi<Name>;

  navNodeApi: NavNodeApi<Name, BufferNode>;
};
