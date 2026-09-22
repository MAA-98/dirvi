import { createTreeNodeApi } from '../tree-node/tree-node.impl.js';
import {
  FoldNode, FoldNodeApi,
  FoldNodeService,
} from './fold-node.types.js';
import { SerializableKey } from '../tree-node/tree-node.types.js';

export function createFoldNodeService<Id extends SerializableKey>(
  rootId: Id,
  foldNodeApi: FoldNodeApi<Id>,
  createChild: (id: Id) => FoldNode<Id>,
): FoldNodeService<Id> {
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
        rootNode,
        path,
        (candidate) => candidate,
      );

      return node !== undefined && node.folds.has(entryId);
    },

    addFoldedEntryAtPath(rootNode, path, entryId) {
      const rootWithPath = ensurePath(rootNode, path);

      return foldNodeApi.modifyAtPath(rootWithPath, path, (node) =>
        addFoldedEntry(node, entryId),
      );
    },

    removeFoldedEntryAtPath(rootNode, path, entryId) {
      return foldNodeApi.modifyAtPath(rootNode, path, (node) =>
        removeFoldedEntry(node, entryId),
      );
    },

    clearFoldedEntriesAtPath(rootNode, path) {
      return foldNodeApi.modifyAtPath(rootNode, path, clearFoldedEntries);
    },
  };

  // Node-local operations.
  //
  // These functions update only the selected node. Path traversal and immutable
  // ancestor updates are handled by FoldNodeApi.
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

  function clearFoldedEntries<Node extends FoldNode<Id>>(node: Node): Node {
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
   * The path is relative to `rootNode`; an empty path selects the root.
   * This creates fold nodes only and does not modify the buffer tree.
   */
  function ensurePath(rootNode: FoldNode<Id>, path: Id[]): FoldNode<Id> {
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
