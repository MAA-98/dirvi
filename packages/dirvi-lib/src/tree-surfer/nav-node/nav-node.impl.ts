import {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from '../tree-node/tree-node.types.js';
import { FoldNode, FoldNodeApi } from '../fold-node/fold-node.types.js';
import { Cursor, CursorApi } from '../cursor.js';
import {
  isNavBranch,
  NavBranch,
  NavEntry,
  NavNode,
  NavNodeApi,
} from './nav-node.types.js';

export function createNavNodeApi<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(
  treeNodeApi: TreeNodeApi<Id, Node>,
  foldNodeApi: FoldNodeApi<Id>,
  cursorApi: CursorApi<Id>,
): NavNodeApi<Id, Node> {
  const navNodeApi: NavNodeApi<Id, Node> = {
    // Return a nav node from the BufferNode tree and FoldNode tree.
    from(root, foldNode) {
      const visibleEntriesSoFar: NavEntry<Id>[] = [];
      const foldedEntriesSoFar: NavEntry<Id>[] = [];

      for (const entry of root.children) {
        // Find the node
        let navigationEntry: NavEntry<Id>;

        if (treeNodeApi.isBranch(entry)) {
          // If fold node does not have children (recursively no folds),
          // then just use empty.
          const childFoldNode =
            foldNodeApi.getChildById(foldNode, entry.id) ??
            createEmptyFoldNode<Id>(entry.id);

          navigationEntry = {
            ...entry,
            children:
              entry.children === null
                ? null
                : navNodeApi.from(entry, childFoldNode),
          } as NavBranch<Id>;
        } else if (treeNodeApi.isLeaf(entry)) {
          navigationEntry = entry;
        } else {
          // This should be unreachable if BufferNode correctly extends TreeNode.
          throw new Error('Unsupported tree node');
        }

        if (foldNode.folds.has(entry.id)) {
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
      navigation: NavNode<Id>,
      path: readonly Id[],
    ): NavNode<Id> | undefined {
      const [currentId, ...remainingPath] = path;

      // An empty path identifies the current node.
      if (currentId === undefined) {
        return navigation;
      }

      const entry = [...navigation.entries, ...navigation.foldedEntries].find(
        (candidate) => candidate.id === currentId,
      );

      if (entry === undefined) {
        return undefined;
      }

      if (!isNavBranch(entry)) {
        return undefined;
      }

      // The directory has not been loaded/opened.
      if (entry.children === null) {
        return undefined;
      }

      return navNodeApi.getNodeAtPath(entry.children, remainingPath);
    },

    getEntryAtPath(
      navigation: NavNode<Id>,
      path: Id[],
    ): NavEntry<Id> | undefined {
      const [currentId, ...remainingPath] = path;

      if (currentId === undefined) {
        return undefined;
      }

      const entry = [...navigation.entries, ...navigation.foldedEntries].find(
        (candidate) => candidate.id === currentId,
      );

      if (entry === undefined) {
        return undefined;
      }

      if (remainingPath.length === 0) {
        return entry;
      }

      if (!isNavBranch(entry) || entry.children === null) {
        return undefined;
      }

      return navNodeApi.getEntryAtPath(entry.children, remainingPath);
    },

    nextCursor(
      rootNode: NavNode<Id>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
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
      rootNode: NavNode<Id>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
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
      rootNode: NavNode<Id>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
      if (cursor.length === 0) {
        return undefined;
      }

      const cursors = cursorsInNode(rootNode, []);
      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex === -1) {
        return undefined;
      }

      for (let index = currentIndex + 1; index < cursors.length; index += 1) {
        const candidate = cursors[index];

        if (candidate === undefined) {
          continue;
        }

        if (cursorApi.cursorBelongsToSubtree(candidate, cursor)) {
          continue;
        }

        return candidate;
      }

      // The fold row will be created at the end of this directory.
      return [...cursor];
    },

    parentCursor(_navigation, cursor) {
      if (cursor.length === 0) {
        return undefined;
      }

      return cursor.slice(0, -1);
    },

    cursors(navigation, parentPath = []) {
      return cursorsInNode(navigation, parentPath);
    },

    visibleLeavesPaths(
      navigation: NavNode<Id>,
      parentPath: Id[] = [],
    ): Id[][] {
      const paths: Id[][] = [];

      for (const entry of navigation.entries) {
        const entryPath = [...parentPath, entry.id];

        if (isNavBranch(entry)) {
          // A null children value means that the directory has not been
          // loaded/opened, so there are no visible descendant files.
          if (entry.children !== null) {
            paths.push(
              ...navNodeApi.visibleLeavesPaths(entry.children, entryPath),
            );
          }

          continue;
        }

        paths.push(entryPath);
      }

      return paths;
    },
  };

  return navNodeApi;
}

function createEmptyFoldNode<Id extends SerializableKey>(id: Id): FoldNode<Id> {
  return {
    id: id,
    children: [],
    folds: new Set<Id>(),
  };
}

function cursorsInNode<Id extends SerializableKey>(
  node: NavNode<Id>,
  parentPath: readonly Id[],
): Cursor<Id>[] {
  const cursors: Cursor<Id>[] = [];

  // The root navigation node is represented by [].
  if (parentPath.length === 0) {
    cursors.push([]);
  }

  for (const entry of node.entries) {
    const entryPath = [...parentPath, entry.id];

    cursors.push(entryPath);

    if (!isNavBranch(entry) || entry.children === null) {
      continue;
    }

    cursors.push(...cursorsInNode(entry.children, entryPath));
  }

  return cursors;
}
