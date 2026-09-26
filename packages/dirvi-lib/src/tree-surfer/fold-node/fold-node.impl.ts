import type {
  FoldNode,
  FoldNodeApi,
  FoldNodeService,
} from './fold-node.types.js';
import type { SerializableKey } from '../tree-node/tree-node.types.js';

function getFoldedChildById<Id extends SerializableKey>(
  node: FoldNode<Id>,
  id: Id,
): FoldNode<Id> | undefined {
  return node.foldedChildren.find((child) => child.id === id);
}

function hasFoldedChildWithId<Id extends SerializableKey>(
  node: FoldNode<Id>,
  id: Id,
): boolean {
  return getFoldedChildById(node, id) !== undefined;
}

export function createFoldNodeService<Id extends SerializableKey>(
  foldNodeApi: FoldNodeApi<Id>,
): FoldNodeService<Id> {
  function createEmptyNode(id: Id): FoldNode<Id> {
    return {
      id,
      children: [],
      foldedChildren: [],
    };
  }
  
  return {
    createEmptyNode,

    getIfEntryFoldedAtPath(rootNode, path, entryId) {
      const node = foldNodeApi.getAtPath(
        rootNode,
        path,
        (candidate) => candidate,
      );

      return node !== undefined && hasFoldedChildWithId(node, entryId);
    },

    foldedEntriesAtPath(rootNode, path) {
      const node = foldNodeApi.getAtPath(
        rootNode,
        path,
        (candidate) => candidate,
      );

      return node?.foldedChildren.map((child) => child.id);
    },

    addFoldedEntryAtPath(rootNode, path, entryId) {
      const rootWithPath = ensurePath(rootNode, path);

      if (rootWithPath === undefined) {
        return undefined;
      }

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
      return foldNodeApi.modifyAtPath(rootNode, path, (node) =>
        clearFoldedEntries(node),
      );
    },
  };

  // Node-local operations.
  //
  // These functions update only the selected node. Path traversal and immutable
  // ancestor updates are handled by FoldNodeApi.
  function addFoldedEntry(node: FoldNode<Id>, entryId: Id): FoldNode<Id> {
    const existingFoldedChild = getFoldedChildById(node, entryId);

    if (existingFoldedChild !== undefined) {
      return node;
    }

    const childIndex = node.children.findIndex((child) => child.id === entryId);

    const child =
      childIndex === -1 ? createEmptyNode(entryId) : node.children[childIndex]!;

    const children =
      childIndex === -1
        ? node.children
        : node.children.filter((_, index) => index !== childIndex);

    return {
      ...node,
      children,
      foldedChildren: [...node.foldedChildren, child],
    };
  }

  function removeFoldedEntry(node: FoldNode<Id>, entryId: Id): FoldNode<Id> {
    const foldedChildIndex = node.foldedChildren.findIndex(
      (child) => child.id === entryId,
    );

    if (foldedChildIndex === -1) {
      return node;
    }

    const foldedChild = node.foldedChildren[foldedChildIndex]!;

    const foldedChildren = node.foldedChildren.filter(
      (_, index) => index !== foldedChildIndex,
    );

    const hasNestedFoldState =
      foldedChild.children.length > 0 || foldedChild.foldedChildren.length > 0;

    return {
      ...node,
      children: hasNestedFoldState
        ? [...node.children, foldedChild]
        : node.children,
      foldedChildren,
    };
  }
  
  function clearFoldedEntries(node: FoldNode<Id>): FoldNode<Id> {
    if (node.foldedChildren.length === 0) {
      return node;
    }

    const children = [...node.children];

    for (const foldedChild of node.foldedChildren) {
      const hasNestedFoldState =
        foldedChild.children.length > 0 ||
        foldedChild.foldedChildren.length > 0;

      if (hasNestedFoldState) {
        children.push(foldedChild);
      }
    }

    return {
      ...node,
      children,
      foldedChildren: [],
    };
  }

  /**
   * Ensures that the requested path exists in the fold-state tree.
   *
   * The path is relative to `rootNode`; an empty path selects the root.
   * This creates fold nodes only and does not modify the buffer tree.
   */
  function ensurePath(
    rootNode: FoldNode<Id>,
    path: readonly Id[],
  ): FoldNode<Id> | undefined {
    if (path.length === 0) {
      return rootNode;
    }

    const children = ensureChildPath(rootNode, path, 0);

    if (children === undefined) {
      return undefined;
    }

    if (children === rootNode.children) {
      return rootNode;
    }

    return {
      ...rootNode,
      children,
    };
  }
  
  function ensureChildPath(
    parent: FoldNode<Id>,
    path: readonly Id[],
    pathIndex: number,
  ): FoldNode<Id>[] | undefined {
    const id = path[pathIndex];

    if (id === undefined) {
      return parent.children;
    }

    if (hasFoldedChildWithId(parent, id)) {
      return undefined;
    }

    const children = parent.children;
    const childIndex = children.findIndex((child) => child.id === id);

    const child = childIndex === -1 ? createEmptyNode(id) : children[childIndex]!;

    let updatedChild = child;

    if (pathIndex < path.length - 1) {
      const updatedChildren = ensureChildPath(child, path, pathIndex + 1);

      if (updatedChildren === undefined) {
        return undefined;
      }

      if (updatedChildren !== child.children) {
        updatedChild = {
          ...child,
          children: updatedChildren,
        };
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
