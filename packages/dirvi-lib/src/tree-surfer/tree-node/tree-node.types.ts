/**
 * A serializable primitive suitable for use as a stable tree ID.
 *
 * @remarks
 *
 * Numeric IDs must be finite. TypeScript cannot represent the exclusion of
 * `NaN` and infinities from `number`, so values from untrusted sources should
 * be validated with `serializableKeySchema`.
 *
 * For application-specific IDs, define a narrower branded schema and derive
 * its type with `z.output`:
 *
 * @example
 *
 * ```ts
 * const menuIdSchema = z
 *   .string()
 *   .min(1)
 *   .brand<'MenuId'>();
 *
 * type MenuId = z.output<typeof menuIdSchema>;
 *
 * const menuId = menuIdSchema.parse(input);
 * // menuId: MenuId
 *
 * type MenuNode = TreeNode<MenuId, MenuNode>;
 * ```
 */
export type SerializableKey = string | number;

/**
 * A node in a tree.
 *
 * @remarks
 *
 * A node's `id` identifies it among its siblings and is used when resolving
 * paths through the tree.
 *
 * Nodes are discriminated by the shape of their `children` property:
 *
 *  - a leaf has no children and does not have a child collection;
 *  - an open branch has a loaded array of child nodes;
 *  - a closed branch has children that have not been loaded yet and uses
 *   `children: null`.
 *
 * `Node` is the concrete application-specific node type. It may contain
 * additional properties, provided that it preserves the leaf-or-branch shape
 * described by this type.
 *
 * The recursive `Node` parameter allows application-specific properties
 * to be available on every descendant.
 *
 * @typeParam Id - The type of node IDs.
 * @typeParam Node - The application-specific recursive node type.
 *
 * @example
 *
 * ```ts
 * type DirectoryEntry = TreeNode<string, DirectoryEntry> & {
 *   kind: 'file' | 'directory';
 * };
 * ```
 */
export type TreeNode<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = LeafTreeNode<Id> | BranchTreeNode<Id, Node>;

/** A node with no children. */
export type LeafTreeNode<Id extends SerializableKey> = {
  id: Id;
  children?: never;
};

/** A tree node that has children, either loaded or unloaded. */
export type BranchTreeNode<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = OpenBranchTreeNode<Id, Node> | ClosedBranchTreeNode<Id>;

// TODO Later: Add a dictionary by ID for faster lookup.
//  Then children will just be an array for keeping order.

/** A branch whose direct children have been loaded. */
export type OpenBranchTreeNode<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = {
  id: Id;
  children: Node[];
};

/** A branch whose direct children have not been loaded. */
export type ClosedBranchTreeNode<Id extends SerializableKey> = {
  id: Id;
  children: null;
};

/**
 * Operations for inspecting and immutably updating a tree rooted at a node.
 *
 * @remarks
 *
 * A path is an array of IDs relative to the supplied root node.
 *
 * For example, given tree with IDs:
 *
 *   root
 *   └── child
 *
 * the path to `root` is `[]`, and the path to `child` is `['child']`.
 *
 * Paths cannot pass through leaves or closed branches. A closed branch may be
 * the final node in a path. An empty path identifies the root node.
 *
 * @typeParam Id - The type of node IDs.
 * @typeParam Node - The application-specific recursive node type.
 */
export type TreeNodeApi<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = {
  isLeaf(node: Node): node is Node & LeafTreeNode<Id>;
  isBranch(node: Node): node is Node & BranchTreeNode<Id, Node>;
  isClosedBranch(
    node: BranchTreeNode<Id, Node>,
  ): node is ClosedBranchTreeNode<Id>;
  isOpenBranch(
    node: BranchTreeNode<Id, Node>,
  ): node is OpenBranchTreeNode<Id, Node>;

  /**
   * Returns the loaded direct children of an open branch.
   *
   * The children are returned in sibling order. The returned nodes are the
   * existing nodes and are not cloned.
   *
   * @param node - An open branch.
   * @returns The branch's loaded children.
   */
  getChildren(node: OpenBranchTreeNode<Id, Node>): Iterable<Node>;

  /**
   * Finds a direct child by ID.
   *
   * @param node - An open branch.
   * @param id - The ID of the child to find.
   * @returns The existing child, or `undefined` when no matching child exists.
   */
  getChildById(node: OpenBranchTreeNode<Id, Node>, id: Id): Node | undefined;

  /**
   * Applies a selector to the node at a path relative to `root`.
   *
   * The selector is called only after the complete path has been resolved.
   * The selected node is not cloned.
   *
   * @param root - The node searching through.
   * @param path - Path relative to root, with empty selecting the root.
   * @param selector - The function to apply to the resolved node.
   * @returns The selector result, or `undefined` when the path cannot be
   * resolved or the selector returns `undefined`.
   */
  getAtPath<Result>(
    root: Node,
    path: readonly Id[],
    selector: (node: Node) => Result,
  ): Result | undefined;

  /**
   * Immutably replaces the node at a path relative to `root`.
   *
   * The modifier is called only after the complete path has been resolved.
   * Returning `undefined` aborts the modification.
   *
   * New arrays and ancestor nodes are created along the modified path.
   * Unrelated nodes and arrays retain their original object identity. The
   * input array is never modified.
   *
   * @param root - The root node to modify.
   * @param path - A path relative to root. An empty path selects the root.
   * @param modifier - Produces the replacement node.
   * @returns A new root, or `undefined` when the path cannot be resolved or
   * the modifier returns `undefined`.
   */
  modifyAtPath(
    root: Node,
    path: readonly Id[],
    modifier: (node: Node) => Node | undefined,
  ): Node | undefined;
};
