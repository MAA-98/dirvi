import { Cursor, CursorApi } from './cursor.js';
import { FoldNode, FoldNodeApi } from './fold-node.js';
import {
  NameEquals,
  TreeNode,
  TreeNodeApi,
  TreeNodeBranch,
  TreeNodeLeaf,
} from './tree-node.js';

/**
 * A navigation entry preserves the original buffer-node properties, but
 * replaces a branch's buffer children with a NavNode.
 */
export type NavEntry<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = NavLeaf<Name, BufferNode> | NavBranch<Name, BufferNode>;

export type NavLeaf<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = BufferNode & TreeNodeLeaf<Name>;

export type NavBranch<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = Omit<BufferNode & TreeNodeBranch<Name, BufferNode>, 'branches'> & {
  branches: NavNode<Name, BufferNode> | null;
};

export function isNavBranch<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(entry: NavEntry<Name, BufferNode>): entry is NavBranch<Name, BufferNode> {
  return 'branches' in entry;
}

/**
 * The derived tree as navigated: list of visible entries and folded entries.
 */
export type NavNode<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  /**
   * Currently visible entries.
   */
  entries: NavEntry<Name, BufferNode>[];

  /**
   * Currently loaded entries hidden by this directory's fold.
   */
  foldedEntries: NavEntry<Name, BufferNode>[];
};

// --- API ---
export type NavNodeApi<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = {
  from(
    entries: BufferNode[],
    foldNode: FoldNode<Name>,
  ): NavNode<Name, BufferNode>;

  getNodeAtPath(
    navigation: NavNode<Name, BufferNode>,
    path: Name[],
  ): NavNode<Name, BufferNode> | undefined;

  getEntryAtPath(
    navigation: NavNode<Name, BufferNode>,
    path: Name[],
  ): NavEntry<Name, BufferNode> | undefined;

  nextCursor(
    rootNode: NavNode<Name, BufferNode>,
    cursor: Cursor<Name>,
  ): Cursor<Name> | undefined;

  previousCursor(
    rootNode: NavNode<Name, BufferNode>,
    cursor: Cursor<Name>,
  ): Cursor<Name> | undefined;

  cursorAfterFold(
    rootNode: NavNode<Name, BufferNode>,
    cursor: Cursor<Name>,
  ): Cursor<Name> | undefined;

  parentCursor(
    navigation: NavNode<Name, BufferNode>,
    cursor: Cursor<Name>,
  ): Cursor<Name> | undefined;

  visibleFilesPaths(
    navigation: NavNode<Name, BufferNode>,
    isFile: (entry: NavEntry<Name, BufferNode>) => boolean,
    parentPath?: Name[],
  ): Name[][];
};

export function createNavNodeApi<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Name, BufferNode>,
  foldNodeApi: FoldNodeApi<Name, BufferNode>,
  cursorApi: CursorApi<Name>,
  nameEquals: NameEquals<Name>,
): NavNodeApi<Name, BufferNode> {
  const navNodeApi: NavNodeApi<Name, BufferNode> = {
    // Return a nav node from the BufferNode tree and FoldNode tree.
    from(entries, foldNode) {
      const visibleEntriesSoFar: NavEntry<Name, BufferNode>[] = [];
      const foldedEntriesSoFar: NavEntry<Name, BufferNode>[] = [];

      for (const entry of entries) {
        // Find the node
        let navigationEntry: NavEntry<Name, BufferNode>;

        if (treeNodeApi.isTreeNodeBranch(entry)) {
          // If fold node does not have children (recursively no folds),
          // then just use empty.
          const childFoldNode =
            foldNode.children[entry.name] ?? foldNodeApi.createEmpty();

          navigationEntry = {
            ...entry,
            branches:
              entry.branches === null
                ? null
                : navNodeApi.from(entry.branches, childFoldNode),
          } as NavBranch<Name, BufferNode>;
        } else if (treeNodeApi.isTreeNodeLeaf(entry)) {
          navigationEntry = entry;
        } else {
          // This should be unreachable if BufferNode correctly extends TreeNode.
          throw new Error('Unsupported tree node');
        }

        const isFolded =
          foldNode?.folds.some((foldedName) =>
            nameEquals(foldedName, entry.name),
          ) ?? false;

        if (isFolded) {
          foldedEntriesSoFar.push(navigationEntry);
        } else {
          visibleEntriesSoFar.push(navigationEntry);
        }
      }

      return {
        entries: visibleEntriesSoFar,
        foldedEntries: foldedEntriesSoFar,
      };
    },

    getNodeAtPath(
      navigation: NavNode<Name, BufferNode>,
      path: Name[],
    ): NavNode<Name, BufferNode> | undefined {
      const [currentName, ...remainingPath] = path;

      // An empty path identifies the current node.
      if (currentName === undefined) {
        return navigation;
      }

      const entry = [...navigation.entries, ...navigation.foldedEntries].find(
        (candidate) => nameEquals(candidate.name, currentName),
      );

      if (entry === undefined) {
        return undefined;
      }

      if (!isNavBranch(entry)) {
        return undefined;
      }

      // The directory has not been loaded/opened.
      if (entry.branches === null) {
        return undefined;
      }

      return navNodeApi.getNodeAtPath(entry.branches, remainingPath);
    },

    getEntryAtPath(
      navigation: NavNode<Name, BufferNode>,
      path: Name[],
    ): NavEntry<Name, BufferNode> | undefined {
      const [currentName, ...remainingPath] = path;

      if (currentName === undefined) {
        return undefined;
      }

      const entry = [...navigation.entries, ...navigation.foldedEntries].find(
        (candidate) => nameEquals(candidate.name, currentName),
      );

      if (entry === undefined) {
        return undefined;
      }

      if (remainingPath.length === 0) {
        return entry;
      }

      if (!isNavBranch(entry) || entry.branches === null) {
        return undefined;
      }

      return navNodeApi.getEntryAtPath(entry.branches, remainingPath);
    },

    nextCursor(
      rootNode: NavNode<Name, BufferNode>,
      cursor: Cursor<Name>,
    ): Cursor<Name> | undefined {
      const cursors = cursorsInNode(rootNode, []);

      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex === -1 || currentIndex === cursors.length - 1) {
        return undefined;
      }

      return cursors[currentIndex + 1];
    },

    previousCursor(
      rootNode: NavNode<Name, BufferNode>,
      cursor: Cursor<Name>,
    ): Cursor<Name> | undefined {
      const cursors = cursorsInNode(rootNode, []);

      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex <= 0) {
        return undefined;
      }

      return cursors[currentIndex - 1];
    },

    cursorAfterFold(
      rootNode: NavNode<Name, BufferNode>,
      cursor: Cursor<Name>,
    ): Cursor<Name> | undefined {
      if (cursorApi.isFold(cursor)) {
        return undefined;
      }

      const cursors = cursorsInNode(rootNode, []);

      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex === -1) {
        return undefined;
      }

      const foldedPath = [...cursor.parentPath, cursor.entryName];

      for (let index = currentIndex + 1; index < cursors.length; index += 1) {
        const candidate = cursors[index];

        if (candidate === undefined) {
          continue;
        }

        if (cursorApi.cursorBelongsToSubtree(candidate, foldedPath)) {
          continue;
        }

        return candidate;
      }

      // The fold row will be created at the end of this directory.
      return {
        kind: 'fold',
        parentPath: cursor.parentPath,
      };
    },

    parentCursor(
      navigation: NavNode<Name, BufferNode>,
      cursor: Cursor<Name>,
    ): Cursor<Name> | undefined {
      const parentPath = cursor.parentPath;

      // The cursor is already in the root directory.
      if (parentPath.length === 0) {
        return undefined;
      }

      const entryName = parentPath.at(-1);

      if (entryName === undefined) {
        return undefined;
      }

      const containingPath = parentPath.slice(0, -1);
      const entry = navNodeApi.getEntryAtPath(navigation, parentPath);

      // The parent path must identify a navigable branch.
      if (entry === undefined || !isNavBranch(entry)) {
        return undefined;
      }

      return {
        kind: 'entry',
        parentPath: containingPath,
        entryName,
      };
    },

    visibleFilesPaths(
      navigation: NavNode<Name, BufferNode>,
      isFile: (entry: NavEntry<Name, BufferNode>) => boolean,
      parentPath: Name[] = [],
    ): Name[][] {
      const paths: Name[][] = [];

      for (const entry of navigation.entries) {
        const entryPath = [...parentPath, entry.name];

        if (isNavBranch(entry)) {
          // A null branches value means that the directory has not been
          // loaded/opened, so there are no visible descendant files.
          if (entry.branches !== null) {
            paths.push(
              ...navNodeApi.visibleFilesPaths(
                entry.branches,
                isFile,
                entryPath,
              ),
            );
          }

          continue;
        }

        if (isFile(entry)) {
          paths.push(entryPath);
        }
      }

      return paths;
    },
  };

  return navNodeApi;
}

function cursorsInNode<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(node: NavNode<Name, BufferNode>, parentPath: Name[]): Cursor<Name>[] {
  const cursors: Cursor<Name>[] = [];

  for (const entry of node.entries) {
    cursors.push({
      kind: 'entry',
      parentPath,
      entryName: entry.name,
    });

    if (!isNavBranch(entry) || entry.branches === null) {
      continue;
    }

    cursors.push(...cursorsInNode(entry.branches, [...parentPath, entry.name]));
  }

  if (node.foldedEntries.length > 0) {
    cursors.push({
      kind: 'fold',
      parentPath,
    });
  }

  return cursors;
}
