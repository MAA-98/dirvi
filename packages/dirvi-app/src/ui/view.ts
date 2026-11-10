import type { HighlightToken, PresentNode } from 'dirvi-apis';

import type {
  Cursor,
  NavEntry,
  NavFold,
  NavBranch,
  NavNode,
  NavMethods,
  CursorMethods,
  FoldCursor,
} from 'dirvi-lib';

type ViewRowBase = {
  indent: number;
  content: string;
  cursor: boolean;
  selected: boolean;
  highlight: HighlightToken;
};

export type ViewRow =
  | (ViewRowBase & {
      type: 'leaf';
    })
  | (ViewRowBase & {
      type: 'branch';
      foldedCount: number;
    })
  | (ViewRowBase & {
      type: 'fold';
      foldedCount: number;
    });

export type View = {
  rows: ViewRow[];
};

export const View = {
  /**
   * Creates all the view rows for a given root nav node.
   * @param rootNode
   * @param navMethods
   * @param cursor
   * @param cursorMethods
   * @param presentNode
   */
  createRows<Id, Value>(
    rootNode: NavBranch<Id, Value>,
    navMethods: NavMethods<Id, Value>,
    cursor: Cursor<Id>,
    cursorMethods: CursorMethods<Id>,
    presentNode: PresentNode<Id, Value>,
  ): ViewRow[] {
    const rootCursor: Cursor<Id> = { path: [] };

    // Collect all FoldCursors in the tree, stays empty when unordered since
    // there's no fold cursors.
    const allFoldCursors: FoldCursor<Id>[] = [];

    if (rootNode.children !== null) {
      for (const position of navMethods.cursors(rootNode.children)) {
        if (cursorMethods.isFoldCursor(position)) {
          allFoldCursors.push(position);
        }
      }
    }

    const rootRow = viewRowForEntry(
      rootNode,
      null,
      cursorMethods.equal(cursor, rootCursor),
      navMethods,
      cursorMethods,
      presentNode,
      allFoldCursors,
    );

    if (rootNode.children === null) {
      return [rootRow];
    }

    return [
      rootRow,
      ...viewRowsAtNode(
        rootNode.children,
        [],
        navMethods,
        cursor,
        cursorMethods,
        presentNode,
        allFoldCursors,
      ),
    ];
  },

  create<Id, Value>(
    rootNode: NavBranch<Id, Value>,
    navNodeApi: NavMethods<Id, Value>,
    cursor: Cursor<Id>,
    cursorMethods: CursorMethods<Id>,
    viewportHeight: number,
    viewportStart: number,
    presentNode: PresentNode<Id, Value>,
  ): View {
    const rows = View.createRows(
      rootNode,
      navNodeApi,
      cursor,
      cursorMethods,
      presentNode,
    );

    return {
      rows: rows.slice(viewportStart, viewportStart + viewportHeight),
    };
  },
};

function isInlineFold<Id>(
  inlineFoldCursors: readonly FoldCursor<Id>[],
  parentPath: readonly Id[],
  firstId: Id,
  cursorMethods: CursorMethods<Id>,
): boolean {
  const entryCursor: Cursor<Id> = {
    parentPath: [...parentPath],
    firstId,
  };

  return inlineFoldCursors.some((position) =>
    cursorMethods.equal(position, entryCursor),
  );
}

/**
 * Converts one NavNode and its descendants into display ViewRows.
 *
 * `parentPath` is the path of that directory. For example:
 *
 *   []              root directory
 *   ['src']         root/src
 *   ['src', 'lib']  root/src/lib
 */
function viewRowsAtNode<Id, Value>(
  node: NavNode<Id, Value>,
  parentPath: Id[],
  navMethods: NavMethods<Id, Value>,
  cursor: Cursor<Id>,
  cursorMethods: CursorMethods<Id>,
  presentNode: PresentNode<Id, Value>,
  foldCursors: FoldCursor<Id>[],
): ViewRow[] {
  const rows: ViewRow[] = [];

  for (const entry of node.entries) {
    if (navMethods.entryIsFold(entry)) {
      const firstEntry = entry.folded[0];

      // Match navigation's guard for empty or richer future fold contents.
      if (firstEntry === undefined || navMethods.entryIsFold(firstEntry)) {
        continue;
      }

      const id = [...parentPath, firstEntry.id];

      // Unordered summaries belong to the parent, not separate rows.
      if (
        !isInlineFold(foldCursors, parentPath, firstEntry.id, cursorMethods)
      ) {
        continue;
      }

      const entryCursor: Cursor<Id> = {
        parentPath: [...parentPath],
        firstId: firstEntry.id,
      };

      // Reuse the first hidden entry's highlight until folds have a presenter.
      const { highlight } = presentNode(
        firstEntry.id,
        firstEntry.value,
        navMethods.entryIsBranch(firstEntry),
      );

      rows.push({
        indent: parentPath.length + 1,
        content: `… ${entry.folded.length} folded`,
        cursor: cursorMethods.equal(cursor, entryCursor),
        selected: false,
        highlight,
        type: 'fold',
        foldedCount: entry.folded.length,
      });

      // Hidden descendants are never rendered separately.
      continue;
    }

    const entryCursor: Cursor<Id> = {
      path: [...parentPath, entry.id],
    };
    const isCursor = cursorMethods.equal(cursor, entryCursor);

    rows.push(
      viewRowForEntry(
        entry,
        parentPath,
        isCursor,
        navMethods,
        cursorMethods,
        presentNode,
        foldCursors,
      ),
    );

    // Case where there's no branches
    if (!navMethods.entryIsBranch(entry) || entry.children === null) {
      continue;
    }

    rows.push(
      ...viewRowsAtNode(
        entry.children,
        [...parentPath, entry.id],
        navMethods,
        cursor,
        cursorMethods,
        presentNode,
        foldCursors,
      ),
    );
  }

  return rows;
}

/**
 * Creates one row for a node. For branches, summarizes direct child folds
 * that do not have their own inline rows.
 * @param entry
 * @param parentPath
 * @param cursor
 * @param navMethods
 * @param cursorMethods
 * @param presentNode
 * @param foldCursors
 */
function viewRowForEntry<Id, Value>(
  entry: Exclude<NavEntry<Id, Value>, NavFold<Id, Value>>,
  parentPath: Id[] | null,
  cursor: boolean,
  navMethods: NavMethods<Id, Value>,
  cursorMethods: CursorMethods<Id>,
  presentNode: PresentNode<Id, Value>,
  foldCursors: FoldCursor<Id>[],
): ViewRow {
  const indent = parentPath ? parentPath.length + 1 : 0;
  const selected = false;

  if (navMethods.entryIsBranch(entry)) {
    const { content, highlight } = presentNode(entry.id, entry.value, true);
    const entryPath = parentPath === null ? [] : [...parentPath, entry.id];

    // For unordered trees: count folded entries to display, by assuming the
    // `NavFold` is the first in the `NavNode` entries.
    const firstEntry = entry.children?.entries[0];
    const foldedCount =
      firstEntry !== undefined && navMethods.entryIsFold(firstEntry)
        ? firstEntry.folded.length
        : 0;

    return {
      indent,
      selected,
      cursor,
      content,
      highlight,
      type: 'branch',
      foldedCount,
    };
  }

  const { content, highlight } = presentNode(entry.id, entry.value, false);
  return {
    indent,
    selected,
    cursor,
    content,
    highlight,
    type: 'leaf',
  };
}
