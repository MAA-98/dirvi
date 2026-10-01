import type {
  FoldNode,
  FoldNodeApi,
  FoldNodeService,
} from './fold-node.types.js';
import type { SerializableKey } from '../tree-node/index.js';

/**
 * Creates semantic operations for a fold-state tree.
 *
 * Structural children are owned by `FoldNodeApi`; folded children are
 * application-owned FoldNode values stored in `FoldNodeValue`.
 */
export function createFoldNodeService<Id extends SerializableKey>(
  foldNodeApi: FoldNodeApi<Id>,
): FoldNodeService<Id> {
  function createEmptyNode(id: Id): FoldNode<Id> {
    const node = foldNodeApi.createLoadedBranch(id, { foldedChildren: [] }, []);

    /*
     * An empty child collection cannot contain duplicate sibling IDs, so this
     * would indicate a broken TreeNodeApi implementation or changed contract.
     */
    if (node === undefined) {
      throw new Error('Could not create an empty fold node');
    }

    return node;
  }

  /**
   * Returns an array snapshot of loaded structural children.
   *
   * Fold nodes are intended always to be open branches. `undefined` therefore
   * signals an invalid FoldNode supplied to this service, for example one made
   * with `asLeaf` or `asClosedBranch` through the lower-level tree API.
   */
  function getStructuralChildren(
    node: FoldNode<Id>,
  ): FoldNode<Id>[] | undefined {
    const children = foldNodeApi.getLoadedChildren(node);

    return children === undefined ? undefined : [...children];
  }

  function getFoldedChildren(node: FoldNode<Id>): readonly FoldNode<Id>[] {
    return foldNodeApi.value(node).foldedChildren;
  }

  function getFoldedChildById(
    node: FoldNode<Id>,
    id: Id,
  ): FoldNode<Id> | undefined {
    return getFoldedChildren(node).find(
      (child) => foldNodeApi.id(child) === id,
    );
  }

  function hasFoldedChildWithId(node: FoldNode<Id>, id: Id): boolean {
    return getFoldedChildById(node, id) !== undefined;
  }

  /**
   * Replaces only fold-domain data, retaining the node's ID and structural
   * child state.
   */
  function withFoldedChildren(
    node: FoldNode<Id>,
    foldedChildren: readonly FoldNode<Id>[],
  ): FoldNode<Id> {
    return foldNodeApi.withValue(node, {
      ...foldNodeApi.value(node),
      foldedChildren,
    });
  }

  /**
   * Replaces structural children while requiring that the source node is
   * already an open branch.
   *
   * `withChildren` could convert any tree node into an open branch. That is
   * useful in the generic API, but FoldNodeService wants to preserve its
   * invariant that every FoldNode is already an open branch.
   */
  function withStructuralChildren(
    node: FoldNode<Id>,
    children: Iterable<FoldNode<Id>>,
  ): FoldNode<Id> | undefined {
    if (foldNodeApi.getLoadedChildren(node) === undefined) {
      return undefined;
    }

    return foldNodeApi.withLoadedChildren(node, children);
  }

  /**
   * Returns whether a fold-state node carries state below itself.
   *
   * A folded node has nested state when it has either:
   *
   * - structural child fold nodes; or
   * - folded direct children.
   */
  function hasNestedFoldState(node: FoldNode<Id>): boolean | undefined {
    const structuralChildren = getStructuralChildren(node);

    if (structuralChildren === undefined) {
      return undefined;
    }

    return structuralChildren.length > 0 || getFoldedChildren(node).length > 0;
  }

  return {
    createEmptyNode,

    getIfEntryFoldedAtPath(rootNode, path, entryId) {
      return (
        foldNodeApi.selectAtPath(rootNode, path, (node) =>
          hasFoldedChildWithId(node, entryId),
        ) ?? false
      );
    },

    foldedEntriesAtPath(rootNode, path) {
      return foldNodeApi.selectAtPath(rootNode, path, (node) =>
        getFoldedChildren(node).map(foldNodeApi.id),
      );
    },

    addFoldedEntryAtPath(rootNode, path, entryId) {
      const rootWithPath = ensurePath(rootNode, path);

      if (rootWithPath === undefined) {
        return undefined;
      }

      return foldNodeApi.updateAtPath(rootWithPath, path, (node) =>
        addFoldedEntry(node, entryId),
      );
    },

    removeFoldedEntryAtPath(rootNode, path, entryId) {
      return foldNodeApi.updateAtPath(rootNode, path, (node) =>
        removeFoldedEntry(node, entryId),
      );
    },

    clearFoldedEntriesAtPath(rootNode, path) {
      return foldNodeApi.updateAtPath(rootNode, path, clearFoldedEntries);
    },
  };

  /**
   * Folds a direct child at one node.
   *
   * If the child already exists as a structural child, it moves to
   * `foldedChildren`, preserving any fold state beneath it. If it does not
   * exist in either collection, a new empty fold node is created.
   */
  function addFoldedEntry(
    node: FoldNode<Id>,
    entryId: Id,
  ): FoldNode<Id> | undefined {
    if (hasFoldedChildWithId(node, entryId)) {
      return node;
    }

    const children = getStructuralChildren(node);

    if (children === undefined) {
      return undefined;
    }

    const childIndex = children.findIndex(
      (child) => foldNodeApi.id(child) === entryId,
    );

    const foldedChild =
      childIndex === -1 ? createEmptyNode(entryId) : children[childIndex];

    if (foldedChild === undefined) {
      return undefined;
    }

    const remainingChildren =
      childIndex === -1
        ? children
        : [...children.slice(0, childIndex), ...children.slice(childIndex + 1)];

    const nodeWithoutStructuralChild = withStructuralChildren(
      node,
      remainingChildren,
    );

    if (nodeWithoutStructuralChild === undefined) {
      return undefined;
    }

    return withFoldedChildren(nodeWithoutStructuralChild, [
      ...getFoldedChildren(nodeWithoutStructuralChild),
      foldedChild,
    ]);
  }

  /**
   * Unfolds a direct child at one node.
   *
   * A folded child that has nested fold state is moved into structural
   * children. A folded child without nested state is omitted entirely.
   */
  function removeFoldedEntry(
    node: FoldNode<Id>,
    entryId: Id,
  ): FoldNode<Id> | undefined {
    const foldedChildren = getFoldedChildren(node);

    const foldedChildIndex = foldedChildren.findIndex(
      (child) => foldNodeApi.id(child) === entryId,
    );

    if (foldedChildIndex === -1) {
      return node;
    }

    const foldedChild = foldedChildren[foldedChildIndex];

    if (foldedChild === undefined) {
      return undefined;
    }

    const hasNestedState = hasNestedFoldState(foldedChild);

    if (hasNestedState === undefined) {
      return undefined;
    }

    const remainingFoldedChildren = [
      ...foldedChildren.slice(0, foldedChildIndex),
      ...foldedChildren.slice(foldedChildIndex + 1),
    ];

    const nodeWithoutFoldedChild = withFoldedChildren(
      node,
      remainingFoldedChildren,
    );

    if (!hasNestedState) {
      return nodeWithoutFoldedChild;
    }

    const children = getStructuralChildren(nodeWithoutFoldedChild);

    if (children === undefined) {
      return undefined;
    }

    return withStructuralChildren(nodeWithoutFoldedChild, [
      ...children,
      foldedChild,
    ]);
  }

  /**
   * Unfolds all directly folded children at one node.
   *
   * Folded children that contain nested state become structural children;
   * empty folded children are omitted.
   */
  function clearFoldedEntries(node: FoldNode<Id>): FoldNode<Id> | undefined {
    const foldedChildren = getFoldedChildren(node);

    if (foldedChildren.length === 0) {
      return node;
    }

    const children = getStructuralChildren(node);

    if (children === undefined) {
      return undefined;
    }

    const retainedFoldedChildren: FoldNode<Id>[] = [];

    for (const foldedChild of foldedChildren) {
      const nestedState = hasNestedFoldState(foldedChild);

      if (nestedState === undefined) {
        return undefined;
      }

      if (nestedState) {
        retainedFoldedChildren.push(foldedChild);
      }
    }

    const nodeWithoutFoldedChildren = withFoldedChildren(node, []);

    return withStructuralChildren(nodeWithoutFoldedChildren, [
      ...children,
      ...retainedFoldedChildren,
    ]);
  }

  /**
   * Ensures the path exists as structural fold nodes.
   *
   * A path may not pass through a folded child: folded children represent
   * entries whose contents are collapsed, so they cannot simultaneously be
   * part of the visible structural fold-state path.
   */
  function ensurePath(
    rootNode: FoldNode<Id>,
    path: readonly Id[],
  ): FoldNode<Id> | undefined {
    return ensurePathAtIndex(rootNode, path, 0);
  }

  function ensurePathAtIndex(
    node: FoldNode<Id>,
    path: readonly Id[],
    pathIndex: number,
  ): FoldNode<Id> | undefined {
    if (pathIndex === path.length) {
      return node;
    }

    const childId = path[pathIndex];

    if (childId === undefined) {
      return undefined;
    }

    /*
     * A folded child is intentionally absent from the structural child tree.
     * Do not create a duplicate FoldNode with the same ID in `children`.
     */
    if (hasFoldedChildWithId(node, childId)) {
      return undefined;
    }

    const children = getStructuralChildren(node);

    if (children === undefined) {
      return undefined;
    }

    const childIndex = children.findIndex(
      (child) => foldNodeApi.id(child) === childId,
    );

    const child =
      childIndex === -1 ? createEmptyNode(childId) : children[childIndex];

    if (child === undefined) {
      return undefined;
    }

    const updatedChild = ensurePathAtIndex(child, path, pathIndex + 1);

    if (updatedChild === undefined) {
      return undefined;
    }

    if (childIndex === -1) {
      return withStructuralChildren(node, [...children, updatedChild]);
    }

    if (updatedChild === child) {
      return node;
    }

    const updatedChildren = [...children];
    updatedChildren[childIndex] = updatedChild;

    return withStructuralChildren(node, updatedChildren);
  }
}
