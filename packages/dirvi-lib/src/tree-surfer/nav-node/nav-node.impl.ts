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
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Id, BufferNode>,
  foldNodeApi: FoldNodeApi<Id>,
  cursorApi: CursorApi<Id>,
): NavNodeApi<Id, BufferNode> {
  const navNodeApi: NavNodeApi<Id, BufferNode> = {
    // Return a nav node from the BufferNode tree and FoldNode tree.
    from(entries, foldNode) {
      const visibleEntriesSoFar: NavEntry<Id, BufferNode>[] = [];
      const foldedEntriesSoFar: NavEntry<Id, BufferNode>[] = [];

      for (const entry of entries) {
        // Find the node
        let navigationEntry: NavEntry<Id, BufferNode>;

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
                : navNodeApi.from(entry.children, childFoldNode),
          } as NavBranch<Id, BufferNode>;
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
      navigation: NavNode<Id, BufferNode>,
      path: Id[],
    ): NavNode<Id, BufferNode> | undefined {
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
      navigation: NavNode<Id, BufferNode>,
      path: Id[],
    ): NavEntry<Id, BufferNode> | undefined {
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
      rootNode: NavNode<Id, BufferNode>,
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
      rootNode: NavNode<Id, BufferNode>,
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
      rootNode: NavNode<Id, BufferNode>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
      const cursors = cursorsInNode(rootNode, []);

      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex === -1) {
        return undefined;
      }

      const foldedPath = [...cursor.parentPath, cursor.entryId];

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
        ...cursor,
        parentPath: cursor.parentPath,
      };
    },

    parentCursor(
      navigation: NavNode<Id, BufferNode>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
      const parentPath = cursor.parentPath;

      // The cursor is already in the root directory.
      if (parentPath.length === 0) {
        return undefined;
      }

      const entryId = parentPath.at(-1);

      if (entryId === undefined) {
        return undefined;
      }

      const containingPath = parentPath.slice(0, -1);
      const entry = navNodeApi.getEntryAtPath(navigation, [...parentPath]);

      // The parent path must identify a navigable branch.
      if (entry === undefined || !isNavBranch(entry)) {
        return undefined;
      }

      return {
        parentPath: containingPath,
        entryId: entryId,
      };
    },

    cursors(navigation, parentPath = []) {
      return cursorsInNode(navigation, parentPath);
    },

    visibleLeavesPaths(
      navigation: NavNode<Id, BufferNode>,
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

function cursorsInNode<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(node: NavNode<Id, BufferNode>, parentPath: Id[]): Cursor<Id>[] {
  const cursors: Cursor<Id>[] = [];

  for (const entry of node.entries) {
    cursors.push({
      parentPath,
      entryId: entry.id,
    });

    if (!isNavBranch(entry) || entry.children === null) {
      continue;
    }

    cursors.push(...cursorsInNode(entry.children, [...parentPath, entry.id]));
  }

  return cursors;
}
