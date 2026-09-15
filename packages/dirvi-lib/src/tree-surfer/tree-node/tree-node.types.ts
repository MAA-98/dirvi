/**
 * A serializable primitive suitable for use as a stable tree ID.
 *
 * The runtime schema guarantees that numeric values are finite. TypeScript
 * cannot represent the exclusion of `NaN` and infinities from `number`, so
 * values from untrusted sources should be validated with
 * `serializableKeySchema` before being used as IDs.
 *
 * For application-specific IDs, define a narrower branded schema and derive
 * its type with `z.output`.
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
 * A node with no children.
 */
export type LeafTreeNode<Id extends SerializableKey> = {
  id: Id;
  children?: never;
};

/**
 * A branch whose children have not been loaded.
 */
export type ClosedBranchTreeNode<Id extends SerializableKey> = {
  id: Id;
  children: null;
};

/**
 * A branch whose children have been loaded.
 *
 * TODO Later: Add a dictionary by ID for faster lookup.
 * Then children will just be an array for keeping order.
 */
export type OpenBranchTreeNode<
  Id extends SerializableKey,
  ChildNode extends TreeNode<Id, ChildNode>,
> = {
  id: Id;
  children: ChildNode[];
};

/**
 * A tree node that has children, either loaded or unloaded.
 */
export type BranchTreeNode<
  Id extends SerializableKey,
  ChildNode extends TreeNode<Id, ChildNode>,
> = OpenBranchTreeNode<Id, ChildNode> | ClosedBranchTreeNode<Id>;

/**
 * A node in a tree.
 *
 * `ChildNode` is the concrete application-specific node type. It may contain
 * additional properties, provided that it has the shape of either a leaf or a
 * branch.
 */
export type TreeNode<
  Id extends SerializableKey,
  ChildNode extends TreeNode<Id, ChildNode>,
> = LeafTreeNode<Id> | BranchTreeNode<Id, ChildNode>;

// ---*--- API ---*---

/**
 * Selects a value from a node reached by a path.
 *
 * The selector is called only when the complete path exists and identifies
 * a node. Returning `undefined` from the selector is allowed, but is
 * indistinguishable from an unsuccessful lookup in the return value.
 */
export type TreeNodeSelector<ChildNode, Result> = (node: ChildNode) => Result;

/**
 * Produces a replacement for a node reached by a path.
 *
 * Returning `undefined` aborts the modification and causes `modifyAtPath`
 * to return `undefined`.
 */
export type TreeNodeModifier<ChildNode> = (
  node: ChildNode,
) => ChildNode | undefined;

/**
 * Fundamental operations for inspecting and immutably updating a tree forest.
 *
 * A forest is represented by an array of root-level nodes. A path is an array
 * of IDs beginning at a root node and continuing through its descendants.
 *
 * For example, given tree with IDs:
 *
 *   root
 *   └── child
 *
 * the path to `child` is `['root', 'child']`.
 *
 * Path traversal and child lookup are performed by this API so that callers
 * do not depend on the internal child-storage representation or need to
 * iterate over children themselves.
 *
 * An empty path does not identify a node and is invalid for both lookup and
 * modification operations.
 */
export type TreeNodeApi<
  Id extends SerializableKey,
  ChildNode extends TreeNode<Id, ChildNode>,
> = {
  // Type Narrowers:

  isLeaf(node: ChildNode): node is ChildNode & LeafTreeNode<Id>;

  isBranch(node: ChildNode): node is ChildNode & BranchTreeNode<Id, ChildNode>;

  isClosedBranch(
    node: BranchTreeNode<Id, ChildNode>,
  ): node is ClosedBranchTreeNode<Id>;

  isOpenBranch(
    node: BranchTreeNode<Id, ChildNode>,
  ): node is OpenBranchTreeNode<Id, ChildNode>;

  /**
   * Returns the loaded children of an open branch.
   *
   * The returned iterable preserves the branch's sibling order. The method
   * can only be called after narrowing the branch with `isOpenBranch`.
   *
   * The returned children are the existing child nodes; they are not cloned.
   */
  getChildren(node: OpenBranchTreeNode<Id, ChildNode>): Iterable<ChildNode>;

  /**
   * Returns the child with the supplied ID.
   *
   * Returns `undefined` when the branch has no child with that ID.
   * The returned child is the existing node; it is not cloned.
   */
  getChildById(
    node: OpenBranchTreeNode<Id, ChildNode>,
    id: Id,
  ): ChildNode | undefined;

  /**
   * Applies `selector` to the node at `path`.
   *
   * The path must:
   *
   * - be non-empty;
   * - begin at one of the supplied forest entries;
   * - contain only IDs that identify existing entries;
   * - not traverse through a leaf; and
   * - not traverse through a closed branch.
   *
   * A branch at the end of the path is valid even when it is closed.
   *
   * The selector is called only after the complete path has been resolved.
   * This method does not clone the tree or the selected node.
   *
   * Returns `undefined` when the path cannot be resolved, or when the
   * selector returns `undefined`.
   */
  getAtPath<Result>(
    entries: ChildNode[],
    path: Id[],
    selector: TreeNodeSelector<ChildNode, Result>,
  ): Result | undefined;

  /**
   * Immutably modifies the node at `path`.
   *
   * The modifier is called only after the complete path has been resolved.
   * Its return value replaces the target node. Returning `undefined` aborts
   * the modification.
   *
   * The operation creates new arrays and ancestor nodes along the path.
   * Nodes and arrays unrelated to the path retain their original object
   * identity. The input forest and its nodes (as objects) are never modified.
   *
   * The path must:
   *
   * - be non-empty;
   * - begin at one of the supplied forest entries;
   * - contain only IDs that identify existing entries;
   * - not traverse through a leaf; and
   * - not traverse through a closed branch.
   *
   * A leaf or branch, including a closed branch, may be the final target.
   *
   * Returns `undefined` when:
   *
   * - `path` is empty;
   * - the path does not exist;
   * - an intermediate node is a leaf;
   * - an intermediate branch is closed; or
   * - the modifier returns `undefined`.
   */
  modifyAtPath(
    entries: ChildNode[],
    path: Id[],
    modifier: TreeNodeModifier<ChildNode>,
  ): ChildNode[] | undefined;
};
