export type NameEquals<Name extends {}> = (left: Name, right: Name) => boolean;

type TreeNodeBase<Name extends {}> = {
  name: Name;
};

export type TreeNodeLeaf<Name extends {}> = TreeNodeBase<Name> & {
  branches?: never;
};

// ChildNode is the generic type for the actual full type that
// makes up the tree entries.
//
// Note: `null` branches means not loaded.
//
// ASSUMPTION:
// Among branches of a node, names are unique.
export type TreeNodeBranch<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = TreeNodeBase<Name> & {
  branches: ChildNode[] | null;
};

export type TreeNode<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = TreeNodeLeaf<Name> | TreeNodeBranch<Name, ChildNode>;

// ChildNode is a type that extends TreeNode<Name>, and is the main
// tree node type of interest.
export type TreeNodeApi<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = {
  isTreeNodeBranch(
    node: ChildNode,
  ): node is ChildNode & TreeNodeBranch<Name, ChildNode>;

  isTreeNodeLeaf(node: ChildNode): node is ChildNode & TreeNodeLeaf<Name>;

  getBranches(node: ChildNode): ChildNode[] | null | undefined;

  /**
   * Returns the node at the path.
   */
  getAtPath(entries: ChildNode[], path: Name[]): ChildNode | undefined;

  /**
   * Replaces the branches of the branch node at the path.
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
    const [currentName, ...remainingPath] = path;

    if (currentName === undefined) {
      return undefined;
    }

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
