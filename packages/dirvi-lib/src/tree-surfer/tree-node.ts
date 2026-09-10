/**
 * Compares two node names.
 *
 * The comparator defines name identity. In particular, it is used
 * when locating entries in a forest and when traversing paths.
 */
export type NameEquals<Name extends {}> = (left: Name, right: Name) => boolean;

/**
 * Compares two sequences of names using the supplied name comparator.
 *
 * The comparator is used instead of `===` because names may have
 * application-specific equality rules.
 */
export function nameSeqEqual<Name extends {}>(
  left: readonly Name[],
  right: readonly Name[],
  nameEquals: NameEquals<Name>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (!nameEquals(left[index]!, right[index]!)) {
      return false;
    }
  }

  return true;
}

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
export type LeafTreeNode<Name extends {}> = TreeNodeBase<Name> & {
  branches?: never;
};

/**
 * A branch whose children have been loaded.
 *
 * // TODO Later: Add dictionary byName for faster lookup.
 * // Then array will be just of the names.
 */
export type OpenBranchTreeNode<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = TreeNodeBase<Name> & {
  branches: ChildNode[];
};

/**
 * A branch whose children have not been loaded.
 */
export type ClosedBranchTreeNode<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = TreeNodeBase<Name> & {
  branches: null;
};

/**
 * A tree node that has children, either loaded or unloaded.
 */
export type BranchTreeNode<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> =
  | OpenBranchTreeNode<Name, ChildNode>
  | ClosedBranchTreeNode<Name, ChildNode>;

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
> = LeafTreeNode<Name> | BranchTreeNode<Name, ChildNode>;

/**
 * Selects a value from a node reached by a path.
 *
 * The selector is called only when the complete path exists and identifies
 * a node. Returning `undefined` from the selector is allowed, but is
 * indistinguishable from an unsuccessful lookup in the return value.
 */
export type TreeNodeSelector<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
  Result,
> = (node: ChildNode) => Result;

/**
 * Produces a replacement for a node reached by a path.
 *
 * Returning `undefined` aborts the modification and causes `modifyAtPath`
 * to return `undefined`.
 */
export type TreeNodeModifier<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = (node: ChildNode) => ChildNode | undefined;

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
 * Path traversal and child lookup are performed by this API so that callers
 * do not depend on the internal child-storage representation or need to
 * iterate over children themselves.
 *
 * An empty path does not identify a node and is invalid for both lookup and
 * modification operations.
 */
export type TreeNodeApi<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
> = {
  nameEquals: NameEquals<Name>;

  isLeaf(node: ChildNode): node is ChildNode & LeafTreeNode<Name>;

  isBranch(
    node: ChildNode,
  ): node is ChildNode & BranchTreeNode<Name, ChildNode>;

  isClosedBranch(
    node: BranchTreeNode<Name, ChildNode>,
  ): node is ClosedBranchTreeNode<Name, ChildNode>;

  isOpenBranch(
    node: BranchTreeNode<Name, ChildNode>,
  ): node is OpenBranchTreeNode<Name, ChildNode>;

  /**
   * Returns the loaded children of an open branch.
   *
   * The returned iterable preserves the branch's sibling order. The method
   * can only be called after narrowing the branch with `isOpenBranch`.
   *
   * The returned children are the existing child nodes; they are not cloned.
   */
  getChildren(node: OpenBranchTreeNode<Name, ChildNode>): Iterable<ChildNode>;

  /**
   * Returns the child with the supplied name.
   *
   * Name matching uses the configured `nameEquals` comparator. Returns
   * `undefined` when the branch has no child with that name.
   *
   * The returned child is the existing node; it is not cloned.
   */
  getChildByName(
    node: OpenBranchTreeNode<Name, ChildNode>,
    name: Name,
  ): ChildNode | undefined;

  /**
   * Applies `selector` to the node at `path`.
   *
   * The path must:
   *
   * - be non-empty;
   * - begin at one of the supplied forest entries;
   * - contain only names that identify existing entries;
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
    path: Name[],
    selector: TreeNodeSelector<Name, ChildNode, Result>,
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
   * - contain only names that identify existing entries;
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
    path: Name[],
    modifier: TreeNodeModifier<Name, ChildNode>,
  ): ChildNode[] | undefined;
};

/**
 * Creates an API for inspecting and immutably updating tree nodes.
 *
 * Tree updates do not mutate the supplied forest or its nodes. Updated
 * arrays and ancestor nodes are created as needed, while unrelated nodes
 * retain their original object identity.
 *
 * @param nameEquals
 *  A comparator that returns `true` when two names identify the same entry.
 *  The comparator should be consistent with the uniqueness of sibling names.
 */
export function createTreeNodeApi<
  Name extends {},
  ChildNode extends TreeNode<Name, ChildNode>,
>(nameEquals: NameEquals<Name>): TreeNodeApi<Name, ChildNode> {
  const treeNodeApi: TreeNodeApi<Name, ChildNode> = {
    nameEquals,

    isLeaf(node): node is ChildNode & LeafTreeNode<Name> {
      return !('branches' in node);
    },

    isBranch(node): node is ChildNode & BranchTreeNode<Name, ChildNode> {
      return 'branches' in node;
    },

    isClosedBranch(
      node,
    ): node is ChildNode & ClosedBranchTreeNode<Name, ChildNode> {
      return 'branches' in node && node.branches === null;
    },

    isOpenBranch(
      node,
    ): node is ChildNode & OpenBranchTreeNode<Name, ChildNode> {
      return 'branches' in node && node.branches !== null;
    },

    getChildren(node) {
      return node.branches;
    },

    getChildByName(node, name) {
      return node.branches.find((child) => nameEquals(child.name, name));
    },

    getAtPath(entries, path, selector) {
      if (path.length === 0) {
        return undefined;
      }

      // Accumulator
      let node = entries.find((candidate) =>
        nameEquals(candidate.name, path[0]),
      );

      for (
        let index = 1;
        node !== undefined && index < path.length;
        index += 1
      ) {
        if (treeNodeApi.isBranch(node) && treeNodeApi.isOpenBranch(node)) {
          node = treeNodeApi.getChildByName(node, path[index]);
        } else {
          node = undefined;
        }
      }
      return node === undefined ? undefined : selector(node);
    },

    modifyAtPath(entries, path, modifier) {
      if (path.length === 0) {
        return undefined;
      }

      // Only cloned arrays/nodes are modified below.
      const updatedEntries = [...entries];
      let currentEntries = updatedEntries;

      for (let index = 0; index < path.length; index += 1) {
        const name = path[index]!;

        const childIndex = currentEntries.findIndex((candidate) =>
          nameEquals(candidate.name, name),
        );

        if (childIndex === -1) {
          return undefined;
        }

        const child = currentEntries[childIndex]!;

        if (index === path.length - 1) {
          const replacement = modifier(child);

          if (replacement === undefined) {
            return undefined;
          }

          currentEntries[childIndex] = replacement;
          return updatedEntries;
        }

        if (!treeNodeApi.isBranch(child) || !treeNodeApi.isOpenBranch(child)) {
          // The path cannot continue through a leaf or closed branch.
          return undefined;
        }

        // Clone the child array before modifying it.
        const updatedChildren = [...treeNodeApi.getChildren(child)];

        // Clone the ancestor node and attach the cloned child array.
        currentEntries[childIndex] = {
          ...child,
          branches: updatedChildren,
        } as ChildNode;

        // Continue traversal through the cloned children.
        currentEntries = updatedChildren;
      }

      return undefined;
    },
  };

  return treeNodeApi;
}
