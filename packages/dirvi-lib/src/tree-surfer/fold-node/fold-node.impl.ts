import { createTreeNodeApi } from '../tree-node/tree-node.impl.js';
import {
  FoldNode,
  FoldNodeService,
} from './fold-node.types.js';
import { SerializableKey } from '../tree-node/tree-node.types.js';

export function createFoldNodeService<Id extends SerializableKey>(
  rootId: Id,
  createChild: (id: Id) => FoldNode<Id>,
): FoldNodeService<Id> {
  const foldNodeApi = createTreeNodeApi<Id, FoldNode<Id>>()
  
  return {
    createEmptyRoot() {
      return {
        id: rootId,
        children: [],
        folds: new Set<Id>(),
      };
    },

    getIfEntryFoldedAtPath(rootNode, path, entryId) {
      if (path.length === 0) {
        return rootNode.folds.has(entryId);
      }

      const node = foldNodeApi.getAtPath(
        rootNode.children,
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

      const children = foldNodeApi.modifyAtPath(ensuredRoot.children, path, (node) =>
        addFoldedEntry(node, entryId),
      );
      
      if (children === undefined) {
        return undefined
      }
      
      return {
        ...rootNode,
        children,
      }
    },

    removeFoldedEntryAtPath(rootNode, path, entryId) {
      if (path.length === 0) {
        return removeFoldedEntry(rootNode, entryId);
      }

      const children = foldNodeApi.modifyAtPath(rootNode.children, path, (node) =>
        removeFoldedEntry(node, entryId),
      );
      
      if (children === undefined) {
        return undefined;
      }

      return {
        ...rootNode,
        children,
      };
    },

    clearFoldedEntriesAtPath(rootNode, path) {
      if (path.length === 0) {
        return clearFoldedEntries(rootNode);
      }

      const children = foldNodeApi.modifyAtPath(rootNode.children, path, clearFoldedEntries);
      
      if (children === undefined) {
        return undefined;
      }

      return {
        ...rootNode,
        children,
      };
    },
  };

  // Helpers:
  // `Node extends FoldNodeRoot<Id> | FoldNode<Id>` is used to create two
  // versions of functions: one for the root and one for the children.

  // "Flat" functions
  //
  // Adds entry name to the given node.
  function addFoldedEntry<Node extends FoldNode<Id>>(
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

  function removeFoldedEntry<Node extends FoldNode<Id>>(
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

  function clearFoldedEntries<Node extends FoldNode<Id>>(
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
    rootNode: FoldNode<Id>,
    path: Id[],
  ): FoldNode<Id> {
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
