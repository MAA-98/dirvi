import {
  createTreeNodeApi,
  NameEquals,
  OpenBranchTreeNode, TreeNodeBase,
  TreeNodeModifier,
  TreeNodeSelector,
} from './tree-node.js';

export type FoldNodeBase<Name extends PropertyKey> = {
  folds: ReadonlySet<Name>;
};

// Specifies the folds at a particular branch tree node.
//
// For reuse of the tree node API, is considered as a tree node
// itself, with only open branch nodes.
export type FoldChild<
  Name extends PropertyKey,
  ChildNode extends FoldChild<Name, ChildNode>,
> = OpenBranchTreeNode<Name, ChildNode> & FoldNodeBase<Name>;

// Specifies the folds at the root.
//
// Doesn't have a name so not considered a tree node.
export type FoldRoot<
  Name extends PropertyKey,
  ChildNode extends FoldChild<Name, ChildNode>,
> = { branches: ChildNode[] } & FoldNodeBase<Name>;

export type FoldNodeApi<
  Name extends PropertyKey,
  ChildNode extends FoldChild<Name, ChildNode>,
> = {
  nameEquals: NameEquals<Name>;

  /**
   * Returns the children of either the fold root or a fold node.
   */
  getChildren(node: FoldRoot<Name, ChildNode> | ChildNode): Iterable<ChildNode>;

  /**
   * Returns a direct child by name.
   */
  getChildByName(
    node: FoldRoot<Name, ChildNode> | ChildNode,
    name: Name,
  ): ChildNode | undefined;

  /**
   * Selects a fold node at a path below the root.
   */
  getAtPath<Result>(
    rootNode: FoldRoot<Name, ChildNode>,
    path: Name[],
    selector: TreeNodeSelector<Name, ChildNode, Result>,
  ): Result | undefined;

  /**
   * Immutably modifies a fold node at a path below the root.
   */
  modifyAtPath(
    rootNode: FoldRoot<Name, ChildNode>,
    path: Name[],
    modifier: TreeNodeModifier<Name, ChildNode>,
  ): FoldRoot<Name, ChildNode> | undefined;
};

export function createFoldNodeApi<
  Name extends PropertyKey,
  ChildNode extends FoldChild<Name, ChildNode>,
>(nameEquals: NameEquals<Name>): FoldNodeApi<Name, ChildNode> {
  const treeNodeApi = createTreeNodeApi<Name, ChildNode>(nameEquals);

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

export type FoldNodeService<
  Name extends PropertyKey,
  ChildNode extends FoldChild<Name, ChildNode>,
> = {
  createEmptyRoot(): FoldRoot<Name, ChildNode>;

  getIfEntryFoldedAtPath(
    rootNode: FoldRoot<Name, ChildNode>,
    path: Name[],
    entryName: Name,
  ): boolean;

  addFoldedEntryAtPath(
    rootNode: FoldRoot<Name, ChildNode>,
    path: Name[],
    entryName: Name,
  ): FoldRoot<Name, ChildNode> | undefined;

  removeFoldedEntryAtPath(
    rootNode: FoldRoot<Name, ChildNode>,
    path: Name[],
    entryName: Name,
  ): FoldRoot<Name, ChildNode> | undefined;

  clearFoldedEntriesAtPath(
    rootNode: FoldRoot<Name, ChildNode>,
    path: Name[],
  ): FoldRoot<Name, ChildNode> | undefined;
};

export function createFoldNodeService<
  Name extends PropertyKey,
  ChildNode extends FoldChild<Name, ChildNode>,
>(
  foldNodeApi: FoldNodeApi<Name, ChildNode>,
  createChild: (name: Name) => ChildNode,
): FoldNodeService<Name, ChildNode> {
  return {
    createEmptyRoot() {
      return {
        branches: [],
        folds: new Set<Name>(),
      };
    },

    // TODO: Implement the rest
  };
}

// const foldNode: FoldNodeApi<Name, Entry> = {
//   getIfEntryFolded(node, entry) {
//     return (
//       node !== undefined && hasFoldedEntryNamed(node, entry.name, nameEquals)
//     );
//   },
//
//   addFoldedEntry(node, entry) {
//     if (hasFoldedEntryNamed(node, entry.name, nameEquals)) {
//       return node;
//     }
//
//     return setFoldedEntriesNamed(
//       node,
//       [...node.folds, entry.name],
//       nameEquals,
//     );
//   },
//
//   addFoldedEntryAtPath(rootNode, path, entry) {
//     return foldNode.modifyAtPath(rootNode, path, (node) =>
//       foldNode.addFoldedEntry(node, entry),
//     );
//   },
//
//   createEmpty() {
//     return {
//       children: Object.create(null) as Partial<Record<Name, FoldNode<Name>>>,
//       folds: [],
//     };
//   },
//
//   setFoldedEntries(node, entries) {
//     return setFoldedEntriesNamed(
//       node,
//       entries.map((entry) => entry.name),
//       nameEquals,
//     );
//   },
//
//   removeFoldedEntry(node, entry) {
//     if (!hasFoldedEntryNamed(node, entry.name, nameEquals)) {
//       return node;
//     }
//
//     return setFoldedEntriesNamed(
//       node,
//       node.folds.filter((entryName) => !nameEquals(entryName, entry.name)),
//       nameEquals,
//     );
//   },
//
//   clearFoldedEntries(node) {
//     if (node.folds.length === 0) {
//       return node;
//     }
//
//     return setFoldedEntriesNamed(node, [], nameEquals);
//   },
// };