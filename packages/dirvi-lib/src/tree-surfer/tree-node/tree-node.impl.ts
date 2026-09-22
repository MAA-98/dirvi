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

    getAtPath(root, path, selector) {
      let node = root;

      for (const id of path) {
        if (!treeNodeApi.isBranch(node) || !treeNodeApi.isOpenBranch(node)) {
          return undefined;
        }

        const child = treeNodeApi.getChildById(node, id);

        if (child === undefined) {
          return undefined;
        }

        node = child;
      }

      return selector(node);
    },

    modifyAtPath(root, path, modifier) {
      if (path.length === 0) {
        return modifier(root);
      }

      return modifyChildAtPath(root, path, modifier);
    },
  };
  
  function modifyChildAtPath(
    node: Node,
    path: readonly Id[],
    modifier: (node: Node) => Node | undefined,
  ): Node | undefined {
    const childId = path[0];

    if (
      childId === undefined ||
      !treeNodeApi.isBranch(node) ||
      !treeNodeApi.isOpenBranch(node)
    ) {
      return undefined;
    }

    const childIndex = node.children.findIndex((child) => child.id === childId);

    if (childIndex === -1) {
      return undefined;
    }

    const child = node.children[childIndex];

    if (child === undefined) {
      return undefined;
    }

    const updatedChild =
      path.length === 1
        ? modifier(child)
        : modifyChildAtPath(child, path.slice(1), modifier);

    if (updatedChild === undefined) {
      return undefined;
    }

    const children = [...node.children];
    children[childIndex] = updatedChild;

    return {
      ...node,
      children,
    } as Node;
  }

  return treeNodeApi;
}
