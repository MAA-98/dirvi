import {
  createTreeNodeApi,
  NameEquals,
  TreeNodeModifier,
  TreeNodeSelector,
} from './tree-node.js';

/**
 * `nameEquals` must be consistent with JavaScript `Set` equality because
 * fold membership is stored in a native `Set`.
 */

// ---*--- Fold Node Types ---*---

/**
 * Fold state for the root of a buffer forest.
 *
 * The root has no name because it represents the forest itself. Its
 * `branches` contain the fold nodes for the forest's root entries.
 *
 * `folds` contains the names folded at this root. Fold order is not
 * represented here; the buffer tree determines entry order.
 */
export type FoldNodeRoot<Name extends PropertyKey> = {
  branches: FoldNode<Name>[];
  folds: ReadonlySet<Name>;
};

/**
 * Fold state associated with a named node in the buffer tree.
 *
 * A fold node has the shape of an open tree node: its children are always
 * represented by an array, and an empty `branches` array means that no child
 * fold nodes are currently represented.
 *
 * The `folds` set contains the names of entries folded at this node. Fold
 * order is not represented here; the buffer tree determines entry order.
 *
 * The type is structurally compatible with `TreeNode`, allowing the shared
 * `TreeNodeApi` to be used for path traversal and immutable updates.
 */
export type FoldNode<Name extends PropertyKey> = FoldNodeRoot<Name> & {
  name: Name;
};

// ---*--- Fold Node API Types ---*---

/**
 * Operations for navigating and immutably updating fold-tree structure.
 *
 * This API is a projection of `TreeNodeApi` onto the fold-tree
 * representation. Path operations are strict: they only operate on
 * paths that already exist. Creation of missing fold paths belongs to
 * `FoldNodeService`.
 */
export type FoldNodeApi<Name extends PropertyKey> = {
  nameEquals: NameEquals<Name>;

  /**
   * Returns the children of either the fold root or a fold node.
   */
  getChildren(node: FoldNodeRoot<Name> | FoldNode<Name>): Iterable<FoldNode<Name>>;

  /**
   * Returns a direct child by name.
   */
  getChildByName(
    node: FoldNodeRoot<Name> | FoldNode<Name>,
    name: Name,
  ): FoldNode<Name> | undefined;

  /**
   * Selects a fold node at a path below the root.
   */
  getAtPath<Result>(
    rootNode: FoldNodeRoot<Name>,
    path: Name[],
    selector: TreeNodeSelector<Name, FoldNode<Name>, Result>,
  ): Result | undefined;

  /**
   * Immutably modifies a fold node at a path below the root.
   */
  modifyAtPath(
    rootNode: FoldNodeRoot<Name>,
    path: Name[],
    modifier: TreeNodeModifier<Name, FoldNode<Name>>,
  ): FoldNodeRoot<Name> | undefined;
};

// ---*--- Fold Node API Implementation ---*---

export function createFoldNodeApi<
  Name extends PropertyKey,
>(nameEquals: NameEquals<Name>): FoldNodeApi<Name> {
  const treeNodeApi = createTreeNodeApi<Name, FoldNode<Name>>(nameEquals);

  return {
    nameEquals,

    getChildren(node) {
      return node.branches;
    },

    getChildByName(node, name) {
      return node.branches.find((child) => nameEquals(child.name, name));
    },

    getAtPath(rootNode, path, selector) {
      return treeNodeApi.getAtPath(rootNode.branches, path, selector);
    },

    modifyAtPath(rootNode, path, modifier) {
      const branches = treeNodeApi.modifyAtPath(
        rootNode.branches,
        path,
        modifier,
      );

      if (branches === undefined) {
        return undefined;
      }

      return {
        ...rootNode,
        branches,
      };
    },
  };
}

// ---*--- Fold Node Service Type ---*---

/**
 * Semantic operations for managing folded buffer entries.
 *
 * Unlike `FoldNodeApi`, the service may create missing fold paths when
 * adding a fold. This allows an empty root to be populated lazily.
 */
export type FoldNodeService<
  Name extends PropertyKey
> = {
  createEmptyRoot(): FoldNodeRoot<Name>;

  getIfEntryFoldedAtPath(
    rootNode: FoldNodeRoot<Name>,
    path: Name[],
    entryName: Name,
  ): boolean;

  addFoldedEntryAtPath(
    rootNode: FoldNodeRoot<Name>,
    path: Name[],
    entryName: Name,
  ): FoldNodeRoot<Name> | undefined;

  removeFoldedEntryAtPath(
    rootNode: FoldNodeRoot<Name>,
    path: Name[],
    entryName: Name,
  ): FoldNodeRoot<Name> | undefined;

  clearFoldedEntriesAtPath(
    rootNode: FoldNodeRoot<Name>,
    path: Name[],
  ): FoldNodeRoot<Name> | undefined;
};

// ---*--- Fold Node Service Implementation ---*---

export function createFoldNodeService<
  Name extends PropertyKey,
>(
  foldNodeApi: FoldNodeApi<Name>,
  createChild: (name: Name) => FoldNode<Name>,
): FoldNodeService<Name> {
  return {
    createEmptyRoot() {
      return {
        branches: [],
        folds: new Set<Name>(),
      };
    },

    getIfEntryFoldedAtPath(rootNode, path, entryName) {
      if (path.length === 0) {
        return rootNode.folds.has(entryName);
      }

      const node = foldNodeApi.getAtPath(
        rootNode,
        path,
        (candidate) => candidate,
      );

      return node !== undefined && node.folds.has(entryName);
    },

    addFoldedEntryAtPath(rootNode, path, entryName) {
      const ensuredRoot = ensurePath(rootNode, path);

      if (path.length === 0) {
        return addFoldedEntry(ensuredRoot, entryName);
      }

      return foldNodeApi.modifyAtPath(ensuredRoot, path, (node) =>
        addFoldedEntry(node, entryName),
      );
    },

    removeFoldedEntryAtPath(rootNode, path, entryName) {
      if (path.length === 0) {
        return removeFoldedEntry(rootNode, entryName);
      }

      return foldNodeApi.modifyAtPath(rootNode, path, (node) =>
        removeFoldedEntry(node, entryName),
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
  // `Node extends FoldNodeRoot<Name> | FoldNode<Name>` is used to create two
  // versions of functions: one for the root and one for the children.

  // "Flat" functions
  //
  // Adds entry name to the given node.
  function addFoldedEntry<Node extends FoldNodeRoot<Name> | FoldNode<Name>>(
    node: Node,
    entryName: Name,
  ): Node {
    if (node.folds.has(entryName)) {
      return node;
    }

    const folds = new Set(node.folds);
    folds.add(entryName);

    return {
      ...node,
      folds,
    } as Node;
  }

  function removeFoldedEntry<Node extends FoldNodeRoot<Name> | FoldNode<Name>>(
    node: Node,
    entryName: Name,
  ): Node {
    if (!node.folds.has(entryName)) {
      return node;
    }

    const folds = new Set(node.folds);
    folds.delete(entryName);

    return {
      ...node,
      folds,
    } as Node;
  }

  function clearFoldedEntries<Node extends FoldNodeRoot<Name> | FoldNode<Name>>(
    node: Node,
  ): Node {
    if (node.folds.size === 0) {
      return node;
    }

    return {
      ...node,
      folds: new Set<Name>(),
    } as Node;
  }

  /**
   * Ensures that the requested path exists in the fold-state tree.
   *
   * This creates fold nodes only; it does not modify the buffer tree.
   */
  function ensurePath(
    rootNode: FoldNodeRoot<Name>,
    path: Name[],
  ): FoldNodeRoot<Name> {
    if (path.length === 0) {
      return rootNode;
    }

    const branches = ensureChildPath(rootNode.branches, path, 0);

    if (branches === rootNode.branches) {
      return rootNode;
    }

    return {
      ...rootNode,
      branches,
    };
  }

  function ensureChildPath(
    children: FoldNode<Name>[],
    path: Name[],
    pathIndex: number,
  ): FoldNode<Name>[] {
    const name = path[pathIndex];

    if (name === undefined) {
      return children;
    }

    const childIndex = children.findIndex((child) =>
      foldNodeApi.nameEquals(child.name, name),
    );

    const child = childIndex === -1 ? createChild(name) : children[childIndex]!;

    let updatedChild = child;

    if (pathIndex < path.length - 1) {
      const updatedBranches = ensureChildPath(
        child.branches,
        path,
        pathIndex + 1,
      );

      if (updatedBranches !== child.branches) {
        updatedChild = {
          ...child,
          branches: updatedBranches,
        } as FoldNode<Name>;
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
