import type { NodePresenter } from 'dirvi-apis';

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
import type { HighlightSpan } from 'dirvi-apis';

type ViewRowBase = {
  indent: number;
  cursor: boolean;
  selected: boolean;
  spans: readonly HighlightSpan[];
};

export type ViewRow =
  | (ViewRowBase & {
      type: 'leaf';
    })
  | (ViewRowBase & {
      type: 'branch';
      foldedCount?: number;
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
    presentNode: NodePresenter<Id, Value>,
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
      presentNode,
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
    presentNode: NodePresenter<Id, Value>,
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
  presentNode: NodePresenter<Id, Value>,
  foldCursors: FoldCursor<Id>[],
): ViewRow[] {
  const rows: ViewRow[] = [];

  for (const entry of node.entries) {
    if (navMethods.entryIsFold(entry)) {
      const firstFoldedNavEntry = entry.folded[0];

      // Match navigation's guard for empty or richer future fold contents.
      if (
        firstFoldedNavEntry === undefined ||
        navMethods.entryIsFold(firstFoldedNavEntry)
      ) {
        continue;
      }

      // Unordered summaries belong to the parent, not separate rows.
      if (
        !isInlineFold(
          foldCursors,
          parentPath,
          firstFoldedNavEntry.id,
          cursorMethods,
        )
      ) {
        continue;
      }

      const entryCursor: Cursor<Id> = {
        parentPath: [...parentPath],
        firstId: firstFoldedNavEntry.id,
      };

      rows.push({
        indent: parentPath.length + 1,
        cursor: cursorMethods.equal(cursor, entryCursor),
        selected: false,
        spans: [
          {
            content: `… ${entry.folded.length} folded`,
            highlight: 'fold-count',
          },
        ],
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
      viewRowForEntry(entry, parentPath, isCursor, navMethods, presentNode),
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
 * Creates one row for a node. For branches, summarizes direct child folds that
 * do not have their own inline rows.
 * @param entry
 * @param parentPath
 * @param cursor
 * @param navMethods
 * @param presentNode
 */
function viewRowForEntry<Id, Value>(
  entry: Exclude<NavEntry<Id, Value>, NavFold<Id, Value>>,
  parentPath: Id[] | null,
  cursor: boolean,
  navMethods: NavMethods<Id, Value>,
  presentNode: NodePresenter<Id, Value>,
): ViewRow {
  const indent = parentPath ? parentPath.length + 1 : 0;
  const selected = false;

  if (navMethods.entryIsBranch(entry)) {
    // For unordered trees: count folded entries to display, by assuming the
    // `NavFold` is the first in the `NavNode` entries.
    const foldedCount = navMethods.foldedCountIfUnordered(entry) ?? 0;
    const spans = presentNode(
      entry.id,
      entry.value,
      entry.children ? 'loaded-branch' : 'unloaded-branch',
    );

    return {
      indent,
      selected,
      cursor,
      spans,
      type: 'branch',
      ...(foldedCount > 0 ? { foldedCount } : {}),
    };
  }

  const spans = presentNode(entry.id, entry.value, 'leaf');
  return {
    indent,
    selected,
    cursor,
    spans,
    type: 'leaf',
  };
}
