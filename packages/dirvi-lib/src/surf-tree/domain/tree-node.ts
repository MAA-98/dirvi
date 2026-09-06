/**
 * Compares two node names.
 *
 * The comparator defines name identity. In particular, it is used
 * when locating entries in a forest and when traversing paths.
 */
export type NameEquals<Name extends {}> = (left: Name, right: Name) => boolean;

/**
 * The common part of every tree node.
 */
type TreeNodeBase<Name extends {}> = {
  name: Name;
};

/**
 * A node with no children.
 *
 * A leaf does not have a `branches` property. Therefore, a node can be
 * classified at runtime by checking whether it has a `branches` property.
 */
export type TreeNodeLeaf<Name extends {}> = TreeNodeBase<Name> & {
  branches?: never;
};

/**
 * A node that may have children.
 *
 * `branches === null` means that the children are not currently loaded.
 * `branches === []` means that the children are loaded and there are no
 * children.
 *
 * The names of sibling nodes are assumed to be unique according to the
 * configured `NameEquals` function.
 */
export type TreeNodeBranch<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = TreeNodeBase<Name> & {
  branches: ChildNode[] | null;
};

/**
 * A node in a tree.
 *
 * `ChildNode` is the concrete application-specific node type. It may contain
 * additional properties, provided that it has the shape of either a leaf or a
 * branch.
 */
export type TreeNode<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = TreeNodeLeaf<Name> | TreeNodeBranch<Name, ChildNode>;

/**
 * Operations for inspecting and immutably updating a tree forest.
 *
 * A forest is represented by an array of root-level nodes. A path is an array
 * of names beginning at a root node and continuing through its descendants.
 *
 * For example, given:
 *
 *   root
 *   └── child
 *
 * the path to `child` is `['root', 'child']`.
 *
 * An empty path does not identify a node and is treated as invalid.
 */
export type TreeNodeApi<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = {
  isTreeNodeBranch(
    node: ChildNode,
  ): node is ChildNode & TreeNodeBranch<Name, ChildNode>;

  isTreeNodeLeaf(node: ChildNode): node is ChildNode & TreeNodeLeaf<Name>;

  /**
   * Returns a node's branches.
   *
   * Returns:
   *
   * - an array when the node is a loaded branch;
   * - `null` when the node is a branch whose children are not loaded;
   * - `undefined` when the node is a leaf.
   */
  getBranches(node: ChildNode): ChildNode[] | null | undefined;

  /**
   * Returns the node at `path`.
   *
   * The path must begin at one of the supplied forest entries. An empty path,
   * a path containing an unknown name, or a path that attempts to traverse
   * through a leaf or an unloaded branch returns `undefined`.
   *
   * A branch node at the end of a path is returned even when its branches are
   * unloaded.
   *
   * This method returns the existing node object; it does not clone it.
   */
  getAtPath(entries: ChildNode[], path: Name[]): ChildNode | undefined;

  /**
   * Replaces the branches of the branch node at `path`.
   *
   * The operation is immutable:
   *
   * - the input forest is not modified;
   * - new arrays are created for the forest and each ancestor along the path;
   * - nodes unrelated to the path retain their original object identity.
   *
   * `newBranches === null` marks the target branch as unloaded.
   * `newBranches === []` marks it as loaded with no children.
   *
   * The supplied `newBranches` array is stored as provided; it is not cloned.
   * Consequently, callers should avoid mutating that array after passing it to
   * this method.
   *
   * Returns `undefined` when:
   * - `path` is empty;
   * - the path does not exist;
   * - an intermediate node is a leaf;
   * - an intermediate branch has unloaded children;
   * - the target node is a leaf.
   */
  setBranchesAtPath(
    entries: ChildNode[],
    path: Name[],
    newBranches: ChildNode[] | null,
  ): ChildNode[] | undefined;
};

export function createTreeNodeApi<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
>(nameEquals: NameEquals<Name>): TreeNodeApi<Name, ChildNode> {
  /**
   * Replaces the whole node at the path. Since it also replaces the name,
   * and hence the node's path, it doesn't make sense to have it as part of
   * the API.
   */
  const setAtPathHelper = (
    entries: ChildNode[],
    path: Name[],
    replacement: ChildNode,
  ): ChildNode[] | undefined => {
    if (path.length === 0) {
      return undefined;
    }

    const [currentName, ...remainingPath] = path;

    const childIndex = entries.findIndex((candidate) =>
      nameEquals(candidate.name, currentName),
    );

    if (childIndex === -1) {
      return undefined;
    }

    const child = entries[childIndex];

    let updatedChild: ChildNode;

    if (remainingPath.length === 0) {
      updatedChild = replacement;
    } else {
      if (!treeNode.isTreeNodeBranch(child)) {
        return undefined;
      }

      if (child.branches === null) {
        return undefined;
      }

      const updatedBranches = setAtPathHelper(
        child.branches,
        remainingPath,
        replacement,
      );

      if (updatedBranches === undefined) {
        return undefined;
      }

      updatedChild = {
        ...child,
        branches: updatedBranches,
      } as ChildNode;
    }

    const updatedEntries = [...entries];
    updatedEntries[childIndex] = updatedChild;

    return updatedEntries;
  };

  const treeNode: TreeNodeApi<Name, ChildNode> = {
    isTreeNodeBranch(
      node,
    ): node is ChildNode & TreeNodeBranch<Name, ChildNode> {
      return 'branches' in node;
    },

    isTreeNodeLeaf(node): node is ChildNode & TreeNodeLeaf<Name> {
      return !treeNode.isTreeNodeBranch(node);
    },

    getBranches(node) {
      return treeNode.isTreeNodeBranch(node) ? node.branches : undefined;
    },

    getAtPath(entries, path) {
      if (path.length === 0) {
        return undefined;
      }

      for (const [index, name] of path.entries()) {
        const node = entries.find((candidate) =>
          nameEquals(candidate.name, name),
        );

        if (node === undefined) {
          return undefined;
        }

        if (index === path.length - 1) {
          return node;
        }

        if (!treeNode.isTreeNodeBranch(node)) {
          return undefined;
        }

        if (node.branches === null) {
          // The node is a branch, but its children have not been loaded.
          return undefined;
        }

        entries = node.branches;
      }

      return undefined;
    },

    setBranchesAtPath(entries, path, newBranches) {
      if (path.length === 0) {
        return undefined;
      }

      const node = treeNode.getAtPath(entries, path);

      if (node === undefined || !treeNode.isTreeNodeBranch(node)) {
        return undefined;
      }

      return setAtPathHelper(entries, path, {
        ...node,
        branches: newBranches,
      } as ChildNode);
    },
  };

  return treeNode;
}
