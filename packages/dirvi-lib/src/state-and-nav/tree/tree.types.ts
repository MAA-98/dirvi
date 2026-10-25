import type { SerializableKey, TreeNodeModel } from './tree-node.model.js';

/**
 * A private type-level marker used to make {@link TreeNode} opaque.
 *
 * @remarks
 *
 * This declaration intentionally has no runtime value: `declare` causes it
 * to be erased when TypeScript emits JavaScript.
 *
 * WARNING: Brand must not be exported.
 *
 * The marker gives `TreeNode` a property whose key cannot be named by callers.
 * Consequently, callers cannot construct a `TreeNode` using an ordinary
 * object literal. The implementation module is responsible for constructing
 * valid runtime values and exposing them through the public API.
 *
 * This is a compile-time abstraction boundary, not a security boundary.
 * Consumers can still deliberately bypass it with `as unknown as TreeNode<…>`,
 * just as they can bypass other TypeScript checks with assertions.
 */
declare const treeNodeBrand: unique symbol;

/**
 * An immutable tree node with application-defined data.
 *
 * @remarks
 *
 * `TreeNode` is intentionally opaque. Callers may hold, compare by reference,
 * pass, store, and return nodes, but should use {@link TreeMethods} operations
 * to create, inspect, and update them.
 *
 * In particular, callers do not depend on:
 *
 * - the runtime property used to store the node ID;
 * - the runtime property used to store application data;
 * - whether a node is represented as a leaf or a branch object;
 * - how loaded child nodes are stored; or
 * - how unloaded child state is represented internally.
 *
 * This allows the implementation to change its internal representation without
 * requiring ordinary consumers to change.
 *
 * `TreeNode` values are intended to be immutable. Tree update operations
 * return replacement nodes and do not mutate their inputs. This type does not,
 * however, recursively freeze `Value`; applications should define their own
 * value types with `readonly` properties when that is required.
 *
 * @typeParam Id - The type used to identify a node among its siblings.
 * @typeParam Value - Application-owned data stored at each node.
 *
 * @example
 *
 * ```ts
 * type MenuItem = Readonly<{
 *   label: string;
 *   href?: string;
 *   requiredRole: 'guest' | 'member' | 'admin';
 * }>;
 *
 * type MenuTree = TreeNode<MenuId, MenuItem>;
 * ```
 *
 * @example
 *
 * ```ts
 * type DirectoryEntry = Readonly<{
 *   kind: 'file' | 'directory';
 *   name: string;
 *   sizeBytes?: number;
 * }>;
 *
 * type DirectoryTree = TreeNode<DirectoryId, DirectoryEntry>;
 * ```
 */
export type TreeNode<Id extends SerializableKey, Value> = {
  /**
   * A phantom type-level witness for `Id` and `Value`.
   *
   * @remarks
   *
   * This property is not part of the intended runtime representation. Its
   * purpose is to preserve the generic relationship between a tree node, its
   * ID type, and its application-value type while keeping the node opaque.
   */
  readonly [treeNodeBrand]: {
    readonly id: Id;
    readonly value: Value;
  };
};

/**
 * The semantic child kind of tree nodes.
 *
 * @remarks
 *
 * A node is exactly one of these:
 *
 * - `leaf`: The node cannot contain children.
 * - `unloaded-branch`: The node may contain children, but its child collection
 *   has not been loaded and is therefore unavailable.
 * - `loaded-branch`: The node has a loaded child collection. The collection may
 *   be empty.
 *
 * A loaded branch with zero children is distinct from a leaf:
 *
 * - a leaf can never contain children;
 * - an empty loaded branch can contain children, but currently has none;
 * - an unloaded branch may contain children, but they are not currently loaded.
 */
export type TreeNodeKind = 'leaf' | 'unloaded-branch' | 'loaded-branch';

/**
 * Case handlers for inspecting an opaque {@link TreeNode}.
 *
 * @remarks
 *
 * `MatchByKind` provides exhaustive pattern matching over the node's semantic
 * state. It is the preferred operation when behavior differs between leaves,
 * unloaded branches, and loaded branches:
 *
 * - `leaf` receives no `children`, because a leaf cannot have children;
 * - `unloadedBranch` receives no `children`, because its children are not loaded;
 * - `loadedBranch` receives an iterable of loaded direct child nodes in
 *    child order.
 *
 * Every handler must return the same `Result` type.
 *
 * @typeParam Id - The type used to identify nodes among siblings.
 * @typeParam Value - The application-specific value stored at each node.
 * @typeParam Result - The common result type returned by all case handlers.
 *
 * @example
 *
 * ```ts
 * const label = api.matchByKind(node, {
 *   leaf: ({ value }) => value.label,
 *
 *   unloadedBranch: ({ value }) => `${value.label} (loading…)`,
 *
 *   loadedBranch: ({ value, children }) => {
 *     let childCount = 0;
 *
 *     for (const _child of children) {
 *       childCount += 1;
 *     }
 *
 *     return `${value.label} (${childCount})`;
 *   },
 * });
 * ```
 */
export type MatchByKind<
  Id extends SerializableKey,
  Value,
  Result,
> = Readonly<{
  leaf: (
    node: Readonly<{
      id: Id;
      value: Value;
    }>,
  ) => Result;

  unloadedBranch: (
    node: Readonly<{
      id: Id;
      value: Value;
    }>,
  ) => Result;

  loadedBranch: (
    node: Readonly<{
      id: Id;
      value: Value;
      children: Iterable<TreeNode<Id, Value>>;
    }>,
  ) => Result;
}>;

/**
 * Operations for constructing, inspecting, and immutably updating tree nodes.
 *
 * @remarks
 *
 * A `TreeNodeApi` is specialized to one ID type and one application-value
 * type. It owns the structural tree rules: leaf/branch state, child loading
 * state, child order, sibling-ID uniqueness, and immutable ancestor
 * reconstruction.
 *
 * Loaded children form an ordered sequence. Construction and child-replacement
 * operations preserve the supplied iterable's iteration order. Inspection
 * operations expose children in that order, and model conversion preserves it.
 * Replacing a descendant retains its position among siblings.
 *
 * The backing representation is private; these ordering guarantees do not
 * require callers to depend on a particular storage structure.
 *
 * Tree nodes are plain immutable values at runtime. Update operations do not
 * mutate supplied nodes or their loaded child collections. When an update
 * succeeds, only nodes and child collections on the updated path need to be
 * recreated; unrelated parts of the tree may retain their original object
 * identity.
 *
 * A path is an array of IDs relative to a supplied root node. For example,
 * given this tree:
 *
 * ```text
 * root
 * └── child
 * ```
 *
 * the root is addressed by `[]`, and `child` is addressed by `['child']`.
 *
 * Paths cannot pass through leaves or unloaded branches. An unloaded branch may
 * be selected as the final node in a path, but its unloaded descendants cannot
 * be addressed.
 *
 * @typeParam Id - The type used to identify nodes among siblings.
 * @typeParam Value - The application-specific value stored at each node.
 */
export type TreeMethods<Id extends SerializableKey, Value> = Readonly<{
  /**
   * Creates a leaf node.
   *
   * A leaf cannot contain children. To convert an existing node to a leaf while
   * retaining its ID and value, use {@link TreeMethods.toLeaf}.
   *
   * @param id - The ID that identifies this node among its siblings.
   * @param value - Application-owned data stored on the node.
   * @returns A new leaf node.
   */
  createLeaf(id: Id, value: Value): TreeNode<Id, Value>;

  /**
   * Creates a branch whose children are not loaded.
   *
   * An unloaded branch may contain children, but its child collection is not
   * currently available. It is distinct from both a leaf and a loaded branch
   * with an empty child collection.
   */
  createUnloadedBranch(id: Id, value: Value): TreeNode<Id, Value>;

  /**
   * Creates a branch with an ordered, loaded child collection.
   *
   * Children are copied in the supplied iterable's iteration order. Subsequent
   * changes to the supplied collection do not affect the created branch.
   *
   * Direct siblings must have unique IDs. Returns `undefined` if the supplied
   * children contain duplicate sibling IDs.
   *
   * An empty child collection creates a loaded branch with no current children;
   * it does not create a leaf.
   */
  createLoadedBranch(
    id: Id,
    value: Value,
    children: Iterable<TreeNode<Id, Value>>,
  ): TreeNode<Id, Value> | undefined;

  /**
   * Returns a node's stable sibling ID.
   *
   * @param node - The node to inspect.
   * @returns The ID identifying `node` among its siblings.
   */
  id(node: TreeNode<Id, Value>): Id;

  /**
   * Returns application-owned data stored on a node.
   *
   * The value is returned by reference and is not cloned. Callers must not
   * mutate it if the application treats tree nodes as immutable values.
   *
   * @param node - The node to inspect.
   * @returns The value associated with `node`.
   */
  value(node: TreeNode<Id, Value>): Value;

  /**
   * Returns the semantic kind of a node.
   *
   * Prefer {@link TreeMethods.matchByKind} when behavior differs by node kind and all
   * three variants must be handled.
   *
   * @param node - The node to inspect.
   * @returns Whether `node` is a leaf, unloaded branch, or loaded branch.
   */
  kind(node: TreeNode<Id, Value>): TreeNodeKind;

  /**
   * Inspects a node by handling its semantic state exhaustively.
   *
   * @param node - The node to inspect.
   * @param handlers - Case handlers for leaf, and unloaded/loaded branch
   * states.
   * @returns The value returned by the selected case handler.
   */
  matchByKind<Result>(
    node: TreeNode<Id, Value>,
    handlers: MatchByKind<Id, Value, Result>,
  ): Result;

  /**
   * Returns the loaded direct children of a loaded branch in child order.
   *
   * The returned iterable is reusable. Its child nodes are existing values,
   * not defensive clones.
   *
   * Returns `undefined` when `node` is a leaf or an unloaded branch. Use
   * {@link TreeMethods.kind} or {@link TreeMethods.matchByKind} when those cases need
   * to be distinguished.
   *
   * @param node - The node whose direct children to inspect.
   * @returns An iterable of loaded direct children, or `undefined` when children
   * are unavailable because `node` is a leaf or unloaded branch.
   */
  getLoadedChildren(
    node: TreeNode<Id, Value>,
  ): Iterable<TreeNode<Id, Value>> | undefined;

  /**
   * Finds a loaded direct child by sibling ID.
   *
   * The search is performed only among direct children. It does not traverse
   * descendants.
   *
   * @param node - The node whose loaded direct children to search.
   * @param id - The sibling ID to find.
   * @returns The existing matching child, or `undefined` when `node` is not a
   * loaded branch or does not have a direct child with `id`.
   */
  findChildById(
    node: TreeNode<Id, Value>,
    id: Id,
  ): TreeNode<Id, Value> | undefined;

  /**
   * Returns an equivalent node with replacement application data.
   *
   * The returned node retains the original node's ID, semantic child state,
   * and when applicable, child order and existing child-node references.
   * The supplied node is not mutated.
   *
   * @param node - The node to update.
   * @param value - Replacement application-owned data.
   * @returns A replacement node with `value`.
   */
  withValue(node: TreeNode<Id, Value>, value: Value): TreeNode<Id, Value>;

  /**
   * Converts a node to a leaf.
   *
   * The returned node retains the source node's ID and application value.
   * Any existing children, loaded or unloaded, are discarded.
   *
   * @param node - The node to convert.
   * @returns A leaf node with the source node's ID and value.
   */
  toLeaf(node: TreeNode<Id, Value>): TreeNode<Id, Value>;

  /**
   * Converts a node to a branch with unloaded children.
   *
   * The returned node retains the source node's ID and application value.
   * Any currently loaded child collection is discarded.
   *
   * @param node - The node to convert.
   * @returns An unloaded branch with the source node's ID and value.
   */
  toUnloadedBranch(node: TreeNode<Id, Value>): TreeNode<Id, Value>;

  /**
   * Converts a node to a loaded branch with replacement children.
   *
   * The returned node retains the source node's ID and application value.
   * Any previous child state is replaced.
   *
   * Children are copied in the supplied iterable's iteration order. That order
   * becomes the replacement child order. Subsequent changes to the supplied
   * collection do not affect the returned node.
   *
   * Direct siblings must have unique IDs. If two or more supplied children have
   * the same ID, no replacement node is created and this method returns
   * `undefined`.
   *
   * The supplied node and child collection are not mutated.
   *
   * @param node - The node to convert or update.
   * @param children - Replacement loaded direct children. Their IDs must be
   * unique among direct siblings.
   * @returns A loaded branch with the source node's ID and value, or
   * `undefined` when `children` contains duplicate sibling IDs.
   */
  withLoadedChildren(
    node: TreeNode<Id, Value>,
    children: Iterable<TreeNode<Id, Value>>,
  ): TreeNode<Id, Value> | undefined;

  /**
   * Finds the node addressed by a path relative to `root`.
   *
   * An empty path selects `root`. Resolution fails when a path refers to a
   * missing child or attempts to pass through a leaf or unloaded branch.
   *
   * @param root - The root node relative to which `path` is interpreted.
   * @param path - A sibling-ID path relative to `root`.
   * @returns The existing node at `path`, or `undefined` when the path cannot
   * be resolved.
   */
  findAtPath(
    root: TreeNode<Id, Value>,
    path: readonly Id[],
  ): TreeNode<Id, Value> | undefined;

  /**
   * Applies a selector to the node addressed by a path relative to `root`.
   *
   * The selector runs only after the complete path has been resolved. The
   * selected node is supplied as the existing node value and is not cloned.
   *
   * An empty path selects `root`. Resolution fails when a path refers to a
   * missing child or attempts to pass through a leaf or an unloaded branch.
   *
   * @param root - The root node relative to which `path` is interpreted.
   * @param path - A sibling-ID path relative to `root`.
   * @param selector - A function applied to the resolved node.
   * @returns The selector result, or `undefined` when the path cannot be
   * resolved or when `selector` itself returns `undefined`.
   */
  selectAtPath<Result>(
    root: TreeNode<Id, Value>,
    path: readonly Id[],
    selector: (node: TreeNode<Id, Value>) => Result,
  ): Result | undefined;

  /**
   * Immutably replaces the node addressed by a path relative to `root`.
   *
   * The update callback runs only after the complete path has been resolved.
   * Returning `undefined` aborts the operation and causes this method to return
   * `undefined`.
   *
   * An empty path selects `root`. When a descendant is replaced, replacement
   * nodes are created only along the path from `root` to that descendant. Nodes
   * outside that path retain their original object identity.
   *
   * The `update` may return a node with a different ID. If it does, the
   * replacement is subsequently addressed by its new ID rather than the old
   * path segment. The replacement retains the original node's position among
   * siblings, and all other siblings retain their relative order.
   *
   * The update also fails when the replacement node's ID duplicates the ID of
   * one of its new siblings. This can occur when `update` returns a node with
   * a different ID.
   *
   * @param root - The root node relative to which `path` is interpreted.
   * @param path - A sibling-ID path relative to `root`.
   * @param update - Produces a replacement node, or `undefined` to abort.
   * @returns A replacement root, or `undefined` when the path cannot be
   *  resolved, `update` aborts, or the replacement would create duplicate
   *  sibling IDs.
   */
  updateAtPath(
    root: TreeNode<Id, Value>,
    path: readonly Id[],
    update: (node: TreeNode<Id, Value>) => TreeNode<Id, Value> | undefined,
  ): TreeNode<Id, Value> | undefined;

  /**
   * Converts an opaque runtime node into a public structural model.
   *
   * Creates fresh model objects and child arrays recursively, preserving child
   * order at every loaded branch. Application-owned values are retained by
   * reference, not cloned; callers must treat those values as immutable.
   *
   * The model is suitable for JSON serialization when `Id` and `Value` are
   * JSON-serializable.
   */
  toModel(node: TreeNode<Id, Value>): TreeNodeModel<Id, Value>;

  /**
   * Constructs an opaque tree from a public structural model.
   *
   * Creates new runtime nodes and child collections, preserving child order
   * at every loaded branch. Application-owned values are retained by reference,
   * not cloned.
   *
   * Returns `undefined` if any loaded child collection contains duplicate
   * sibling IDs.
   *
   * This function assumes the model has already been validated as data of the
   * expected shape. Use a schema/decoder at untrusted boundaries.
   */
  fromModel(model: TreeNodeModel<Id, Value>): TreeNode<Id, Value> | undefined;
}>;
