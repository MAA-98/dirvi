import { createTreeNodeApi } from '../tree-node/tree-node.impl.js';
import {
  FoldNode,
  FoldNodeApi,
  FoldNodeRoot,
  FoldNodeService,
} from './fold-node.types.js';
import { SerializableKey } from '../tree-node/tree-node.types.js';

export function createFoldNodeApi<Id extends SerializableKey>(): FoldNodeApi<Id> {
  const treeNodeApi = createTreeNodeApi<Id, FoldNode<Id>>();

  return {
    getChildren(node) {
      return node.children;
    },

    getChildById(node, id) {
      return node.children.find((child) => child.id === id);
    },

    getAtPath(rootNode, path, selector) {
      return treeNodeApi.getAtPath(rootNode.children, path, selector);
    },

    modifyAtPath(rootNode, path, modifier) {
      const children = treeNodeApi.modifyAtPath(
        rootNode.children,
        path,
        modifier,
      );

      if (children === undefined) {
        return undefined;
      }

      return {
        ...rootNode,
        children,
      };
    },
  };
}

export function createFoldNodeService<Id extends SerializableKey>(
  foldNodeApi: FoldNodeApi<Id>,
  createChild: (id: Id) => FoldNode<Id>,
): FoldNodeService<Id> {
  return {
    createEmptyRoot() {
      return {
        children: [],
        folds: new Set<Id>(),
      };
    },

    getIfEntryFoldedAtPath(rootNode, path, entryId) {
      if (path.length === 0) {
        return rootNode.folds.has(entryId);
      }

      const node = foldNodeApi.getAtPath(
        rootNode,
        path,
        (candidate) => candidate,
      );

      return node !== undefined && node.folds.has(entryId);
    },

    addFoldedEntryAtPath(rootNode, path, entryId) {
      const ensuredRoot = ensurePath(rootNode, path);

      if (path.length === 0) {
        return addFoldedEntry(ensuredRoot, entryId);
      }

      return foldNodeApi.modifyAtPath(ensuredRoot, path, (node) =>
        addFoldedEntry(node, entryId),
      );
    },

    removeFoldedEntryAtPath(rootNode, path, entryId) {
      if (path.length === 0) {
        return removeFoldedEntry(rootNode, entryId);
      }

      return foldNodeApi.modifyAtPath(rootNode, path, (node) =>
        removeFoldedEntry(node, entryId),
      );
    },

    clearFoldedEntriesAtPath(rootNode, path) {
      if (path.length === 0) {
        return clearFoldedEntries(rootNode);
      }

      return foldNodeApi.modifyAtPath(rootNode, path, clearFoldedEntries);
    },
  };

  // Helpers:
  // `Node extends FoldNodeRoot<Id> | FoldNode<Id>` is used to create two
  // versions of functions: one for the root and one for the children.

  // "Flat" functions
  //
  // Adds entry name to the given node.
  function addFoldedEntry<Node extends FoldNodeRoot<Id> | FoldNode<Id>>(
    node: Node,
    entryId: Id,
  ): Node {
    if (node.folds.has(entryId)) {
      return node;
    }

    const folds = new Set(node.folds);
    folds.add(entryId);

    return {
      ...node,
      folds,
    } as Node;
  }

  function removeFoldedEntry<Node extends FoldNodeRoot<Id> | FoldNode<Id>>(
    node: Node,
    entryId: Id,
  ): Node {
    if (!node.folds.has(entryId)) {
      return node;
    }

    const folds = new Set(node.folds);
    folds.delete(entryId);

    return {
      ...node,
      folds,
    } as Node;
  }

  function clearFoldedEntries<Node extends FoldNodeRoot<Id> | FoldNode<Id>>(
    node: Node,
  ): Node {
    if (node.folds.size === 0) {
      return node;
    }

    return {
      ...node,
      folds: new Set<Id>(),
    } as Node;
  }

  /**
   * Ensures that the requested path exists in the fold-state tree.
   *
   * This creates fold nodes only; it does not modify the buffer tree.
   */
  function ensurePath(
    rootNode: FoldNodeRoot<Id>,
    path: Id[],
  ): FoldNodeRoot<Id> {
    if (path.length === 0) {
      return rootNode;
    }

    const children = ensureChildPath(rootNode.children, path, 0);

    if (children === rootNode.children) {
      return rootNode;
    }

    return {
      ...rootNode,
      children,
    };
  }

  function ensureChildPath(
    children: FoldNode<Id>[],
    path: Id[],
    pathIndex: number,
  ): FoldNode<Id>[] {
    const id = path[pathIndex];

    if (id === undefined) {
      return children;
    }

    const childIndex = children.findIndex((child) => child.id === id);

    const child = childIndex === -1 ? createChild(id) : children[childIndex]!;

    let updatedChild = child;

    if (pathIndex < path.length - 1) {
      const updatedChildren = ensureChildPath(
        child.children,
        path,
        pathIndex + 1,
      );

      if (updatedChildren !== child.children) {
        updatedChild = {
          ...child,
          children: updatedChildren,
        } as FoldNode<Id>;
      }
    }

    if (childIndex === -1) {
      return [...children, updatedChild];
    }

    if (updatedChild === child) {
      return children;
    }

    const result = [...children];
    result[childIndex] = updatedChild;
    return result;
  }
}
