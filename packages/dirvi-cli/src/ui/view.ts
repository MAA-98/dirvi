import { CursorApi, SerializableKey, TreeNode } from 'dirvi-lib';
import { Cursor, isNavBranch, NavEntry, NavNode } from 'dirvi-lib';

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
  createRows<
    Id extends SerializableKey,
    BufferNode extends TreeNode<Id, BufferNode>,
  >(
    navigation: NavNode<Id, BufferNode>,
    cursor: Cursor<Id>,
    cursorApi: CursorApi<Id>,
  ): ViewRow[] {
    return viewRowsAtNode(navigation, [], cursor, cursorApi);
  },

  create<
    Id extends SerializableKey,
    BufferNode extends TreeNode<Id, BufferNode>,
  >(
    navigation: NavNode<Id, BufferNode>,
    cursor: Cursor<Id>,
    cursorApi: CursorApi<Id>,
    viewportHeight: number,
    viewportStart: number,
  ): View {
    const rows = View.createRows(navigation, cursor, cursorApi);

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
function viewRowsAtNode<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  node: NavNode<Id, BufferNode>,
  parentPath: Id[],
  cursor: Cursor<Id>,
  cursorApi: CursorApi<Id>,
): ViewRow[] {
  const rows: ViewRow[] = [];

  /*
   * `node.entries` contains only the entries currently visible in this directory.
   */
  for (const entry of node.entries) {
    const entryCursor: Cursor<Id> = {
      parentPath,
      entryId: entry.id,
    };

    const isCursor = cursorApi.equal(cursor, entryCursor);
    rows.push(viewRowForEntry(entry, parentPath, isCursor));

    // Case where there's no branches
    if (!isNavBranch(entry) || entry.children === null) {
      continue;
    }

    rows.push(
      ...viewRowsAtNode(
        entry.children,
        [...parentPath, entry.id],
        cursor,
        cursorApi,
      ),
    );
  }

  return rows;
}

function viewRowForEntry<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(entry: NavEntry<Id, BufferNode>, parentPath: Id[], cursor: boolean): ViewRow {
  if (isNavBranch(entry)) {
    const foldedCount =
      entry.children === null ? 0 : entry.children.foldedEntries.length;

    return {
      id: entryId(parentPath, entry.id),
      indent: parentPath.length,
      selected: cursor,
      cursor,
      content: `${String(entry.id)}/`,
      type: 'branch',
      foldedCount,
    };
  }

  return {
    id: entryId(parentPath, entry.id),
    indent: parentPath.length,
    selected: cursor,
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
