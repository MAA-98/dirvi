import type {
  BranchTreeNode,
  ClosedBranchTreeNode,
  LeafTreeNode,
  OpenBranchTreeNode,
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from './tree-node.types.js';

/**
 * Creates an API for inspecting and immutably updating tree nodes (of the
 * given types).
 *
 * Tree updates do not mutate the supplied forest or its nodes. Updated
 * arrays and ancestor nodes are created as needed, while unrelated nodes
 * retain their original object identity.
 *
 * Node IDs are compared using JavaScript value equality. Sibling IDs
 * should be unique.
 */
export function createTreeNodeApi<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(): TreeNodeApi<Id, Node> {
  const treeNodeApi: TreeNodeApi<Id, Node> = {
    // Type Narrowers:

    isLeaf(node): node is Node & LeafTreeNode<Id> {
      return !('children' in node);
    },

    isBranch(node): node is Node & BranchTreeNode<Id, Node> {
      return 'children' in node;
    },

    isClosedBranch(node): node is Node & ClosedBranchTreeNode<Id> {
      return node.children === null;
    },

    isOpenBranch(node): node is Node & OpenBranchTreeNode<Id, Node> {
      return node.children !== null;
    },

    getChildren(node) {
      return node.children;
    },

    getChildById(node, id) {
      return node.children.find((child) => child.id === id);
    },

    getAtPath(entries, path, selector) {
      if (path.length === 0) {
        return undefined;
      }

      // Accumulator
      let node = entries.find((candidate) => candidate.id === path[0]);

      for (
        let index = 1;
        node !== undefined && index < path.length;
        index += 1
      ) {
        if (treeNodeApi.isOpenBranch(node)) {
          node = treeNodeApi.getChildById(node, path[index]);
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
        const id = path[index]!;

        const childIndex = currentEntries.findIndex(
          (candidate) => candidate.id === id,
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
          children: updatedChildren,
        } as Node;

        // Continue traversal through the cloned children.
        currentEntries = updatedChildren;
      }

      return undefined;
    },
  };

  return treeNodeApi;
}
