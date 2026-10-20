import type {
  Cursor,
  CursorApi, HighlightToken,
  NavBranch,
  NavEntry,
  NavNode,
  NavNodeApi, PresentNode,
  SerializableKey,
} from 'dirvi-lib';

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
    presentNode: PresentNode<Id>
  ): ViewRow[] {
    const rootCursor: Cursor<Id> = [];

    const rootRow = viewRowForEntry(
      rootNode,
      null,
      cursorApi.equal(cursor, rootCursor),
      navNodeApi,
      presentNode
    );

    if (rootNode.children === null) {
      return [rootRow];
    }

    return [
      rootRow,
      ...viewRowsAtNode(rootNode.children, [], navNodeApi, cursor, cursorApi, presentNode),
    ];
  },

  create<Id extends SerializableKey, Value>(
    rootNode: NavBranch<Id>,
    navNodeApi: NavNodeApi<Id, Value>,
    cursor: Cursor<Id>,
    cursorApi: CursorApi<Id>,
    viewportHeight: number,
    viewportStart: number,
    presentNode: PresentNode<Id>
  ): View {
    const rows = View.createRows(rootNode, navNodeApi, cursor, cursorApi, presentNode);

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
  presentNode: PresentNode<Id>
): ViewRow[] {
  const rows: ViewRow[] = [];

  for (const entry of node.entries) {
    const entryCursor: Cursor<Id> = [...parentPath, entry.id];
    const isCursor = cursorApi.equal(cursor, entryCursor);
    rows.push(viewRowForEntry(entry, parentPath, isCursor, navNodeApi, presentNode));

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
        presentNode
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
  presentNode: PresentNode<Id>
): ViewRow {
  const id = entryId(parentPath ?? [], entry.id);
  const indent = parentPath ? parentPath.length + 1 : 0;
  const selected = false;

  if (navNodeApi.entryIsBranch(entry)) {
    const { content, highlight } = presentNode(entry.id, true);
    const foldedCount =
      entry.children === null || entry.children.folded === null
        ? 0
        : entry.children.folded.entries.length;

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
