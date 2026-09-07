import { NameEquals } from './tree-node.js';

export type NamedEntry<Name> = {
  name: Name;
};

export type FoldNode<Name extends PropertyKey> = {
  children: Partial<Record<Name, FoldNode<Name>>>;
  folds: Name[];
};

export type FoldNodeApi<
  Name extends PropertyKey,
  Entry extends NamedEntry<Name>,
> = {
  getAtPath(rootNode: FoldNode<Name>, path: Name[]): FoldNode<Name> | undefined;

  getIfEntryFolded(node: FoldNode<Name> | undefined, entry: Entry): boolean;

  modifyAtPath(
    rootNode: FoldNode<Name>,
    path: Name[],
    modifier: (targetNode: FoldNode<Name>) => FoldNode<Name>,
  ): FoldNode<Name>;

  addFoldedEntry(node: FoldNode<Name>, entry: Entry): FoldNode<Name>;

  addFoldedEntryAtPath(
    rootNode: FoldNode<Name>,
    path: Name[],
    entry: Entry,
  ): FoldNode<Name>;

  createEmpty(): FoldNode<Name>;

  setFoldedEntries(node: FoldNode<Name>, entries: Entry[]): FoldNode<Name>;

  removeFoldedEntry(node: FoldNode<Name>, entry: Entry): FoldNode<Name>;

  clearFoldedEntries(node: FoldNode<Name>): FoldNode<Name>;
};

export function createFoldNodeApi<
  Name extends PropertyKey,
  Entry extends NamedEntry<Name>,
>(nameEquals: NameEquals<Name>): FoldNodeApi<Name, Entry> {
  const foldNode: FoldNodeApi<Name, Entry> = {
    getAtPath(rootNode, path) {
      const [currentName, ...remainingPath] = path;

      if (currentName === undefined) {
        return rootNode;
      }

      const childNode = rootNode.children[currentName];

      if (childNode === undefined) {
        return undefined;
      }

      return foldNode.getAtPath(childNode, remainingPath);
    },

    getIfEntryFolded(node, entry) {
      return (
        node !== undefined && hasFoldedEntryNamed(node, entry.name, nameEquals)
      );
    },

    modifyAtPath(rootNode, path, modifier) {
      const [currentName, ...remainingPath] = path;

      if (currentName === undefined) {
        return modifier(rootNode);
      }

      const childNode =
        rootNode.children[currentName] ?? foldNode.createEmpty();

      return {
        ...rootNode,
        children: {
          ...rootNode.children,
          [currentName]: foldNode.modifyAtPath(
            childNode,
            remainingPath,
            modifier,
          ),
        },
      };
    },

    addFoldedEntry(node, entry) {
      if (hasFoldedEntryNamed(node, entry.name, nameEquals)) {
        return node;
      }

      return setFoldedEntriesNamed(
        node,
        [...node.folds, entry.name],
        nameEquals,
      );
    },

    addFoldedEntryAtPath(rootNode, path, entry) {
      return foldNode.modifyAtPath(rootNode, path, (node) =>
        foldNode.addFoldedEntry(node, entry),
      );
    },

    createEmpty() {
      return {
        children: Object.create(null) as Partial<Record<Name, FoldNode<Name>>>,
        folds: [],
      };
    },

    setFoldedEntries(node, entries) {
      return setFoldedEntriesNamed(
        node,
        entries.map((entry) => entry.name),
        nameEquals,
      );
    },

    removeFoldedEntry(node, entry) {
      if (!hasFoldedEntryNamed(node, entry.name, nameEquals)) {
        return node;
      }

      return setFoldedEntriesNamed(
        node,
        node.folds.filter((entryName) => !nameEquals(entryName, entry.name)),
        nameEquals,
      );
    },

    clearFoldedEntries(node) {
      if (node.folds.length === 0) {
        return node;
      }

      return setFoldedEntriesNamed(node, [], nameEquals);
    },
  };

  return foldNode;
}

function hasFoldedEntryNamed<Name extends PropertyKey>(
  node: FoldNode<Name>,
  entryName: Name,
  nameEquals: NameEquals<Name>,
): boolean {
  return node.folds.some((foldedName) => nameEquals(foldedName, entryName));
}

function uniqueEntryNames<Name extends PropertyKey>(
  entryNames: Name[],
  nameEquals: NameEquals<Name>,
): Name[] {
  return entryNames.filter(
    (entryName, index) =>
      entryNames.findIndex((candidate) => nameEquals(candidate, entryName)) ===
      index,
  );
}

function setFoldedEntriesNamed<Name extends PropertyKey>(
  node: FoldNode<Name>,
  entryNames: Name[],
  nameEquals: NameEquals<Name>,
): FoldNode<Name> {
  return {
    ...node,
    folds: uniqueEntryNames(entryNames, nameEquals),
  };
}
