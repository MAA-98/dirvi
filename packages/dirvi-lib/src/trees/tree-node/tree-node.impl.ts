import type {
  TreeNode,
  TreeNodeApi,
  TreeNodeMatch,
  TreeNodeKind,
} from './tree-node.types.js';
import type { SerializableKey, TreeNodeModel } from './tree-node.model.js';

/**
 * Private runtime representation.
 *
 * This representation is intentionally not exported. The public `TreeNode`
 * type is opaque, so consumers must use `TreeNodeApi` operations rather than
 * depending on these object properties.
 */
type TreeNodeData<Id extends SerializableKey, Value> =
  | LeafTreeNodeData<Id, Value>
  | UnloadedBranchTreeNodeData<Id, Value>
  | LoadedBranchTreeNodeData<Id, Value>;

type LeafTreeNodeData<Id extends SerializableKey, Value> = Readonly<{
  id: Id;
  value: Value;
  children?: never;
}>;

type UnloadedBranchTreeNodeData<Id extends SerializableKey, Value> = Readonly<{
  id: Id;
  value: Value;
  children: null;
}>;

type LoadedBranchTreeNodeData<Id extends SerializableKey, Value> = Readonly<{
  id: Id;
  value: Value;
  children: readonly TreeNode<Id, Value>[];
}>;

/**
 * Crosses from the opaque public type into the private representation.
 *
 * This cast is intentionally centralized here. Public callers should never
 * need to know that tree nodes currently use `{ id, value, children }`.
 */
function toData<Id extends SerializableKey, Value>(
  node: TreeNode<Id, Value>,
): TreeNodeData<Id, Value> {
  return node as unknown as TreeNodeData<Id, Value>;
}

/**
 * Crosses from the private representation into the opaque public type.
 */
function fromData<Id extends SerializableKey, Value>(
  data: TreeNodeData<Id, Value>,
): TreeNode<Id, Value> {
  return data as unknown as TreeNode<Id, Value>;
}

function isLeafData<Id extends SerializableKey, Value>(
  node: TreeNodeData<Id, Value>,
): node is LeafTreeNodeData<Id, Value> {
  return !('children' in node);
}

function isUnloadedBranchData<Id extends SerializableKey, Value>(
  node: TreeNodeData<Id, Value>,
): node is UnloadedBranchTreeNodeData<Id, Value> {
  return 'children' in node && node.children === null;
}

function isLoadedBranchData<Id extends SerializableKey, Value>(
  node: TreeNodeData<Id, Value>,
): node is LoadedBranchTreeNodeData<Id, Value> {
  return 'children' in node && node.children !== null;
}

/**
 * Returns a reusable iterable over child nodes without exposing the internal
 * child-array representation.
 *
 * The implementation currently stores children in an array, but callers only
 * receive an `Iterable` and must not rely on iteration order.
 */
function asChildrenIterable<Id extends SerializableKey, Value>(
  children: readonly TreeNode<Id, Value>[],
): Iterable<TreeNode<Id, Value>> {
  return Object.freeze({
    *[Symbol.iterator](): Iterator<TreeNode<Id, Value>> {
      yield* children;
    },
  });
}

/**
 * Copies an arbitrary child iterable into the current private representation
 * and verifies sibling-ID uniqueness.
 *
 * Returning `undefined` represents an invalid child collection rather than an
 * exceptional implementation failure. This matches the public API contract
 * for `createLoadedBranch` and `withLoadedChildren`.
 */
function copyUniqueChildren<Id extends SerializableKey, Value>(
  children: Iterable<TreeNode<Id, Value>>,
  getId: (node: TreeNode<Id, Value>) => Id,
): readonly TreeNode<Id, Value>[] | undefined {
  const copiedChildren = [...children];
  const seenIds = new Set<Id>();

  for (const child of copiedChildren) {
    const id = getId(child);

    if (seenIds.has(id)) {
      return undefined;
    }

    seenIds.add(id);
  }

  return Object.freeze(copiedChildren);
}

function createLeafData<Id extends SerializableKey, Value>(
  id: Id,
  value: Value,
): LeafTreeNodeData<Id, Value> {
  return Object.freeze({
    id,
    value,
  });
}

function createUnloadedBranchData<Id extends SerializableKey, Value>(
  id: Id,
  value: Value,
): UnloadedBranchTreeNodeData<Id, Value> {
  return Object.freeze({
    id,
    value,
    children: null,
  });
}

function createLoadedBranchData<Id extends SerializableKey, Value>(
  id: Id,
  value: Value,
  children: readonly TreeNode<Id, Value>[],
): LoadedBranchTreeNodeData<Id, Value> {
  return Object.freeze({
    id,
    value,
    children,
  });
}

/**
 * Creates an API for constructing, inspecting, and immutably updating opaque
 * tree nodes.
 *
 * The returned nodes are ordinary JavaScript objects at runtime. Their
 * structural representation is private to this module; consumers interact
 * with them only through the returned API.
 *
 * Tree updates preserve object identity for unrelated nodes. New ancestor
 * nodes and child collections are created only along an updated path.
 */
export function createTreeNodeApi<
  Id extends SerializableKey,
  Value,
>(): TreeNodeApi<Id, Value> {
  function getOpenChildren(
    node: TreeNode<Id, Value>,
  ): readonly TreeNode<Id, Value>[] | undefined {
    const data = toData(node);

    return isLoadedBranchData(data) ? data.children : undefined;
  }

  const api: TreeNodeApi<Id, Value> = {
    createLeaf(id, value) {
      return fromData(createLeafData(id, value));
    },

    createUnloadedBranch(id, value) {
      return fromData(createUnloadedBranchData(id, value));
    },

    createLoadedBranch(id, value, children) {
      const copiedChildren = copyUniqueChildren(children, api.id);

      if (copiedChildren === undefined) {
        return undefined;
      }

      return fromData(createLoadedBranchData(id, value, copiedChildren));
    },

    id(node) {
      return toData(node).id;
    },

    value(node) {
      return toData(node).value;
    },

    kind(node): TreeNodeKind {
      const data = toData(node);

      if (isLeafData(data)) {
        return 'leaf';
      }

      if (isUnloadedBranchData(data)) {
        return 'unloaded-branch';
      }

      return 'loaded-branch';
    },

    match<Result>(
      node: TreeNode<Id, Value>,
      handlers: TreeNodeMatch<Id, Value, Result>,
    ): Result {
      const data = toData(node);

      if (isLeafData(data)) {
        return handlers.leaf({
          id: data.id,
          value: data.value,
        });
      }

      if (isUnloadedBranchData(data)) {
        return handlers.unloadedBranch({
          id: data.id,
          value: data.value,
        });
      }

      return handlers.loadedBranch({
        id: data.id,
        value: data.value,
        children: asChildrenIterable(data.children),
      });
    },

    getLoadedChildren(node) {
      const children = getOpenChildren(node);

      return children === undefined ? undefined : asChildrenIterable(children);
    },

    findChildById(node, id) {
      const children = getOpenChildren(node);

      if (children === undefined) {
        return undefined;
      }

      for (const child of children) {
        if (api.id(child) === id) {
          return child;
        }
      }

      return undefined;
    },

    withValue(node, value) {
      const data = toData(node);

      if (isLeafData(data)) {
        return fromData(createLeafData(data.id, value));
      }

      if (isUnloadedBranchData(data)) {
        return fromData(createUnloadedBranchData(data.id, value));
      }

      return fromData(createLoadedBranchData(data.id, value, data.children));
    },

    toLeaf(node) {
      const data = toData(node);

      return fromData(createLeafData(data.id, data.value));
    },

    toUnloadedBranch(node) {
      const data = toData(node);

      return fromData(createUnloadedBranchData(data.id, data.value));
    },

    withLoadedChildren(node, children) {
      const copiedChildren = copyUniqueChildren(children, api.id);

      if (copiedChildren === undefined) {
        return undefined;
      }

      const data = toData(node);

      return fromData(
        createLoadedBranchData(data.id, data.value, copiedChildren),
      );
    },

    findAtPath(root, path) {
      return api.selectAtPath(root, path, (node) => node);
    },

    selectAtPath(root, path, selector) {
      let node = root;

      for (const id of path) {
        const child = api.findChildById(node, id);

        if (child === undefined) {
          return undefined;
        }

        node = child;
      }

      return selector(node);
    },

    updateAtPath(root, path, update) {
      if (path.length === 0) {
        return update(root);
      }

      return modifyChildAtPath(root, path, update);
    },
    
    toModel(node): TreeNodeModel<Id, Value> {
      const data = toData(node);
      
      if (isLeafData(data)) {
        return {
          id: data.id,
          value: data.value,
        };
      }
      
      if (isUnloadedBranchData(data)) {
        return {
          id: data.id,
          value: data.value,
          children: null,
        };
      }
      
      return {
        id: data.id,
        value: data.value,
        children: data.children.map(api.toModel),
      };
    },
    
    fromModel(model) {
      if (!('children' in model)) {
        return api.createLeaf(model.id, model.value);
      }

      if (model.children === null) {
        return api.createUnloadedBranch(model.id, model.value);
      }

      const children: TreeNode<Id, Value>[] = [];

      for (const childModel of model.children) {
        const child = api.fromModel(childModel);

        if (child === undefined) {
          return undefined;
        }

        children.push(child);
      }

      return api.createLoadedBranch(model.id, model.value, children);
    }
  };

  function modifyChildAtPath(
    node: TreeNode<Id, Value>,
    path: readonly Id[],
    modifier: (node: TreeNode<Id, Value>) => TreeNode<Id, Value> | undefined,
  ): TreeNode<Id, Value> | undefined {
    const childId = path[0];
    const children = getOpenChildren(node);

    if (childId === undefined || children === undefined) {
      return undefined;
    }

    let childIndex = -1;

    for (const [index, child] of children.entries()) {
      if (api.id(child) === childId) {
        childIndex = index;
        break;
      }
    }

    if (childIndex === -1) {
      return undefined;
    }

    const child = children[childIndex];

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

    /*
     * The current representation happens to use an array, so replacing one
     * child is efficient internally. The public API makes no ordering promise:
     * this is solely an implementation detail.
     */
    const updatedChildren = [...children];
    updatedChildren[childIndex] = updatedChild;

    /*
     * `withChildren` revalidates sibling-ID uniqueness. This matters when
     * `modifier` replaces a node with another node having a different ID.
     */
    return api.withLoadedChildren(node, updatedChildren);
  }

  return api;
}
