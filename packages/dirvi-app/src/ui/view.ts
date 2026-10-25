import type {
  Cursor,
  HighlightToken,
  NavBranch,
  NavNode,
  NavMethods,
  PresentNode,
  SerializableKey, CursorMethods,
} from 'dirvi-lib';
import { NavEntry, NavFold } from 'dirvi-lib/dist/state-and-nav/nav/nav.types.js';

type ViewRowBase = {
  id: string;
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

function foldId<Id extends SerializableKey>(
  parentPath: readonly Id[],
  firstId: Id,
): string {
  return `fold:${JSON.stringify([...parentPath, firstId])}`;
}

export const View = {
  createRows<Id extends SerializableKey, Value>(
    rootNode: NavBranch<Id>,
    navNodeApi: NavMethods<Id, Value>,
    cursor: Cursor<Id>,
    cursorMethods: CursorMethods<Id>,
    presentNode: PresentNode<Id>
  ): ViewRow[] {
    const rootCursor: Cursor<Id> = { path: [] };
    
    const inlineFoldIds = new Set<string>();

    if (rootNode.children !== null) {
      for (const position of navNodeApi.cursors(rootNode.children)) {
        if (cursorMethods.isFoldCursor(position)) {
          inlineFoldIds.add(foldId(position.parentPath, position.firstId));
        }
      }
    }
    
    const rootRow = viewRowForEntry(
      rootNode,
      null,
      cursorMethods.equal(cursor, rootCursor),
      navNodeApi,
      presentNode,
      inlineFoldIds,
    );

    if (rootNode.children === null) {
      return [rootRow];
    }

    return [
      rootRow,
      ...viewRowsAtNode(
        rootNode.children,
        [],
        navNodeApi,
        cursor,
        cursorMethods,
        presentNode,
        inlineFoldIds,
      ),
    ];
  },

  create<Id extends SerializableKey, Value>(
    rootNode: NavBranch<Id>,
    navNodeApi: NavMethods<Id, Value>,
    cursor: Cursor<Id>,
    cursorMethods: CursorMethods<Id>,
    viewportHeight: number,
    viewportStart: number,
    presentNode: PresentNode<Id>
  ): View {
    const rows = View.createRows(rootNode, navNodeApi, cursor, cursorMethods, presentNode);

    return {
      rows: rows.slice(viewportStart, viewportStart + viewportHeight),
    };
  },
};

/**
 * Converts one NavNode and its descendants into display ViewRows.
 *
 * `parentPath` is the path of that directory. For example:
 *
 *   []              root directory
 *   ['src']         root/src
 *   ['src', 'lib']  root/src/lib
 */
function viewRowsAtNode<Id extends SerializableKey, Value>(
  node: NavNode<Id>,
  parentPath: Id[],
  navNodeApi: NavMethods<Id, Value>,
  cursor: Cursor<Id>,
  cursorMethods: CursorMethods<Id>,
  presentNode: PresentNode<Id>,
  inlineFoldIds: ReadonlySet<string>
): ViewRow[] {
  const rows: ViewRow[] = [];
  
  for (const entry of node.entries) {
    if (navNodeApi.entryIsFold(entry)) {
      const firstEntry = entry.folded[0];

      // Match navigation's guard for empty or richer future fold contents.
      if (firstEntry === undefined || navNodeApi.entryIsFold(firstEntry)) {
        continue;
      }

      const id = foldId(parentPath, firstEntry.id);

      // Unordered summaries belong to the parent, not separate rows.
      if (!inlineFoldIds.has(id)) {
        continue;
      }

      const entryCursor: Cursor<Id> = {
        parentPath: [...parentPath],
        firstId: firstEntry.id,
      };

      // Reuse the first hidden entry's highlight until folds have a presenter.
      const { highlight } = presentNode(
        firstEntry.id,
        navNodeApi.entryIsBranch(firstEntry),
      );

      rows.push({
        id,
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
        navNodeApi,
        presentNode,
        inlineFoldIds,
      ),
    );

    // Case where there's no branches
    if (!navNodeApi.entryIsBranch(entry) || entry.children === null) {
      continue;
    }

    rows.push(
      ...viewRowsAtNode(
        entry.children,
        [...parentPath, entry.id],
        navNodeApi,
        cursor,
        cursorMethods,
        presentNode,
        inlineFoldIds,
      ),
    );
  }

  return rows;
}

function viewRowForEntry<Id extends SerializableKey, Value>(
  entry: Exclude<NavEntry<Id>, NavFold<Id>>,
  parentPath: Id[] | null,
  cursor: boolean,
  navNodeApi: NavMethods<Id, Value>,
  presentNode: PresentNode<Id>,
  inlineFoldIds: ReadonlySet<string>,
): ViewRow {
  const id = entryId(parentPath ?? [], entry.id);
  const indent = parentPath ? parentPath.length + 1 : 0;
  const selected = false;

  if (navNodeApi.entryIsBranch(entry)) {
    const { content, highlight } = presentNode(entry.id, true);
    const entryPath = parentPath === null ? [] : [...parentPath, entry.id];

    const foldedCount =
      entry.children?.entries.reduce((count, entry) => {
        if (!navNodeApi.entryIsFold(entry)) {
          return count;
        }

        const firstEntry = entry.folded[0];

        if (firstEntry === undefined || navNodeApi.entryIsFold(firstEntry)) {
          return count;
        }

        // Ordered folds already have their own rows.
        if (inlineFoldIds.has(foldId(entryPath, firstEntry.id))) {
          return count;
        }

        return count + entry.folded.length;
      }, 0) ?? 0;

    return {
      id,
      indent,
      selected,
      cursor,
      content: content,
      highlight,
      type: 'branch',
      foldedCount,
    };
  }

  const { content, highlight } = presentNode(entry.id, false);
  return {
    id,
    indent,
    selected,
    cursor,
    content,
    highlight,
    type: 'leaf',
  };
}

function entryId<Name extends PropertyKey>(
  parentPath: Name[],
  entryName: Name,
): string {
  return `entry:${JSON.stringify([...parentPath, entryName])}`;
}
