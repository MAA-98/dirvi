import type {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from '../tree-node/tree-node.types.js';
import type { FoldNode, FoldNodeService } from '../fold-node/fold-node.types.js';
import type { Cursor, CursorApi } from '../cursor.js';
import type {
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
  foldNodeService: FoldNodeService<Id>,
  cursorApi: CursorApi<Id>,
): NavNodeApi<Id, Node> {
  function entryIsBranch(entry: NavEntry<Id>): entry is NavBranch<Id> {
    return 'children' in entry;
  }
  
  function createNavNode(
    entries: Node[],
    foldRoot: FoldNode<Id> | undefined,
    parentPath: readonly Id[],
  ): NavNode<Id> {
    const visibleEntries: NavEntry<Id>[] = [];
    const foldedEntries: NavEntry<Id>[] = [];

    const foldedEntryIds =
      foldRoot === undefined
        ? undefined
        : foldNodeService.foldedEntriesAtPath(foldRoot, parentPath);

    for (const entry of entries) {
      const entryPath = [...parentPath, entry.id];

      const isFolded =
        foldRoot !== undefined &&
        foldNodeService.getIfEntryFoldedAtPath(foldRoot, parentPath, entry.id);

      const navigationEntry = createNavEntry(entry, foldRoot, entryPath);

      if (isFolded) {
        foldedEntries.push(navigationEntry);
      } else {
        visibleEntries.push(navigationEntry);
      }
    }

    return {
      entries: visibleEntries,
      folded:
        foldedEntryIds === undefined || foldedEntryIds.length === 0
          ? null
          : {
              entries: foldedEntries,
            },
    };
  }
  
  function createNavEntry(
    entry: Node,
    foldRoot: FoldNode<Id> | undefined,
    entryPath: readonly Id[],
  ): NavEntry<Id> {
    if (treeNodeApi.isLeaf(entry)) {
      return {
        id: entry.id,
      };
    }

    return createNavBranch(entry, foldRoot, entryPath);
  }
  
  function createNavBranch(
    entry: Node,
    foldRoot: FoldNode<Id> | undefined,
    entryPath: readonly Id[],
  ): NavBranch<Id> {
    if (!treeNodeApi.isBranch(entry)) {
      throw new Error('Navigation root must be a branch');
    }

    return {
      id: entry.id,
      children:
        entry.children === null
          ? null
          : createNavNode(entry.children, foldRoot, entryPath),
    };
  }
  
  function rootCursors(
    rootNode: NavBranch<Id>,
  ): Cursor<Id>[] {
    if (rootNode.children === null) {
      return [[]];
    }

    return [[], ...cursorsInNode(rootNode.children, [])];
  }

  function cursorsInNode(
    node: NavNode<Id>,
    parentPath: readonly Id[],
  ): Cursor<Id>[] {
    const cursors: Cursor<Id>[] = [];

    for (const entry of node.entries) {
      const entryPath = [...parentPath, entry.id];

      cursors.push(entryPath);

      if (!entryIsBranch(entry) || entry.children === null) {
        continue;
      }

      cursors.push(...cursorsInNode(entry.children, entryPath));
    }

    return cursors;
  }
  
  const navNodeApi: NavNodeApi<Id, Node> = {
    entryIsBranch,
    
    // Return a nav node from the TreeNode and FoldNode trees.
    from(root, foldRoot) {
      return createNavBranch(root, foldRoot, []);
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
      
      const entry = navigation.entries.find(
        (candidate) => candidate.id === currentId,
      );

      if (entry === undefined) {
        return undefined;
      }

      if (!entryIsBranch(entry)) {
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
      path: readonly Id[],
    ): NavEntry<Id> | undefined {
      const [currentId, ...remainingPath] = path;

      if (currentId === undefined) {
        return undefined;
      }
      
      const entry = navigation.entries.find(
        (candidate) => candidate.id === currentId,
      );

      if (entry === undefined) {
        return undefined;
      }

      if (remainingPath.length === 0) {
        return entry;
      }

      if (!entryIsBranch(entry) || entry.children === null) {
        return undefined;
      }

      return navNodeApi.getEntryAtPath(entry.children, remainingPath);
    },

    nextCursor(
      rootNode: NavBranch<Id>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
      const cursors = rootCursors(rootNode);

      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex === -1 || currentIndex === cursors.length - 1) {
        return undefined;
      }

      return cursors[currentIndex + 1];
    },

    previousCursor(
      rootNode: NavBranch<Id>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
      const cursors = rootCursors(rootNode);

      const currentIndex = cursors.findIndex((candidate) =>
        cursorApi.equal(candidate, cursor),
      );

      if (currentIndex <= 0) {
        return undefined;
      }

      return cursors[currentIndex - 1];
    },

    cursorAfterFold(
      rootNode: NavBranch<Id>,
      cursor: Cursor<Id>,
    ): Cursor<Id> | undefined {
      if (cursor.length === 0) {
        return undefined;
      }

      const cursors = rootCursors(rootNode);
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

    visibleLeavesPaths(navigation: NavNode<Id>, parentPath: Id[] = []): Id[][] {
      const paths: Id[][] = [];

      for (const entry of navigation.entries) {
        const entryPath = [...parentPath, entry.id];

        if (entryIsBranch(entry)) {
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
