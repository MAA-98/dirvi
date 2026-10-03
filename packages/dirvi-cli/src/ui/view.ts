import type {
  Cursor,
  CursorApi,
  NavBranch,
  NavEntry,
  NavNode,
  NavNodeApi,
  SerializableKey,
} from 'dirvi-lib';

type ViewRowBase = {
  id: string;
  indent: number;
  selected: boolean;
  cursor: boolean;
  content: string;
};

export type ViewRow =
  | (ViewRowBase & {
      type: 'leaf';
    })
  | (ViewRowBase & {
      type: 'branch';
      foldedCount: number;
    });

export type View = {
  rows: ViewRow[];
};

export const View = {
  createRows<Id extends SerializableKey, Value>(
    rootNode: NavBranch<Id>,
    navNodeApi: NavNodeApi<Id, Value>,
    cursor: Cursor<Id>,
    cursorApi: CursorApi<Id>,
  ): ViewRow[] {
    const rootCursor: Cursor<Id> = [];

    const rootRow = viewRowForEntry(
      rootNode,
      null,
      cursorApi.equal(cursor, rootCursor),
      navNodeApi,
    );

    if (rootNode.children === null) {
      return [rootRow];
    }

    return [
      rootRow,
      ...viewRowsAtNode(rootNode.children, [], navNodeApi, cursor, cursorApi),
    ];
  },

  create<Id extends SerializableKey, Value>(
    rootNode: NavBranch<Id>,
    navNodeApi: NavNodeApi<Id, Value>,
    cursor: Cursor<Id>,
    cursorApi: CursorApi<Id>,
    viewportHeight: number,
    viewportStart: number,
  ): View {
    const rows = View.createRows(rootNode, navNodeApi, cursor, cursorApi);

    return {
      rows: rows.slice(viewportStart, viewportStart + viewportHeight),
    };
  },
};

/**
 * Converts one NavNode and its descendants into display ViewRows.
 *
 * `node` is the directory currently being visited.
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
  navNodeApi: NavNodeApi<Id, Value>,
  cursor: Cursor<Id>,
  cursorApi: CursorApi<Id>,
): ViewRow[] {
  const rows: ViewRow[] = [];

  for (const entry of node.entries) {
    const entryCursor: Cursor<Id> = [...parentPath, entry.id];
    const isCursor = cursorApi.equal(cursor, entryCursor);
    rows.push(viewRowForEntry(entry, parentPath, isCursor, navNodeApi));

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
        cursorApi,
      ),
    );
  }

  return rows;
}

function viewRowForEntry<Id extends SerializableKey, Value>(
  entry: NavEntry<Id>,
  parentPath: Id[] | null,
  cursor: boolean,
  navNodeApi: NavNodeApi<Id, Value>,
): ViewRow {
  const id = entryId(parentPath ?? [], entry.id);
  const indent = parentPath ? parentPath.length + 1 : 0;
  const selected = false;

  if (navNodeApi.entryIsBranch(entry)) {
    const foldedCount =
      entry.children === null || entry.children.folded === null
        ? 0
        : entry.children.folded.entries.length;

    return {
      id,
      indent,
      selected,
      cursor,
      content: `${String(entry.id)}/`,
      type: 'branch',
      foldedCount,
    };
  }

  return {
    id,
    indent,
    selected,
    cursor,
    content: String(entry.id),
    type: 'leaf',
  };
}

function entryId<Name extends PropertyKey>(
  parentPath: Name[],
  entryName: Name,
): string {
  return `entry:${JSON.stringify([...parentPath, entryName])}`;
}
