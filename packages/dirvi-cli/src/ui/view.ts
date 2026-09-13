import { CursorApi, SerializableKey, TreeNode } from 'dirvi-lib';
import { Cursor, isNavBranch, NavEntry, NavNode } from 'dirvi-lib';

export type ViewRowType = 'leaf' | 'branch' | 'fold';

// A flat display model for the renderer.
//
// The renderer does not need to understand navigation, branches, folds,
// cursors, or paths. It only needs to render these rows in order.
export type ViewRow = {
  // Stable identity used as React/Ink's key.
  id: string;

  // Number of directory levels between this row and the root.
  indent: number;

  // Whether the row is selected.
  selected: boolean;

  // Whether this row currently has the cursor.
  cursor: boolean;

  // Text displayed by the renderer.
  content: string;

  // Used by the renderer to choose the row presentation.
  type: ViewRowType;
};

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
    cursorApi: CursorApi<Id>
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
 *
 * The function uses a depth-first, pre-order traversal:
 *
 *   1. Add an entry's row.
 *   2. If the entry is an opened branch, recursively add its children.
 *   3. After all visible entries, add the directory's fold row.
 *
 * This ordering is what makes the flat row list visually represent a tree.
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
   * `node.entries` contains only the entries currently visible in this
   * directory. Folded entries are kept separately in `node.foldedEntries`
   * and are represented by one fold row added below.
   */
  for (const entry of node.entries) {
    const entryCursor: Cursor<Id> = {
      kind: 'entry',
      parentPath,
      entryId: entry.id,
    };
    
    // If cursor at entry, needs to be rendered differently
    const isCursor = cursorApi.equal(cursor, entryCursor);

    // Add entry before visiting branches
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
        cursorApi
      ),
    );
  }

  /*
   * Folded entries are not rendered individually. They are represented
   * by one synthetic row placed after all visible entries and descendants
   * of this directory.
   */
  if (node.foldedEntries.length > 0) {
    const foldCursor: Cursor<Id> = {
      kind: 'fold',
      parentPath,
    };

    const isCursor = cursorApi.equal(cursor, foldCursor);

    rows.push({
      id: foldId(parentPath),
      indent: parentPath.length,
      selected: isCursor,
      cursor: isCursor,
      content: `⋯ ${node.foldedEntries.length} folded`,
      type: 'fold',
    });
  }

  return rows;
}

function viewRowForEntry<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  entry: NavEntry<Id, BufferNode>,
  parentPath: Id[],
  cursor: boolean,
): ViewRow {
  return {
    id: entryId(parentPath, entry.id),
    indent: parentPath.length,
    selected: cursor,
    cursor,
    content: content(entry),
    type: type(entry),
  };
}

function entryId<Name extends PropertyKey>(
  parentPath: Name[],
  entryName: Name,
): string {
  return `entry:${JSON.stringify([...parentPath, entryName])}`;
}

function foldId<Name extends PropertyKey>(parentPath: Name[]): string {
  return `fold:${JSON.stringify(parentPath)}`;
}

function content<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(entry: NavEntry<Id, BufferNode>): string {
  return isNavBranch(entry) ? `${String(entry.id)}/` : String(entry.id);
}

function type<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(entry: NavEntry<Id, BufferNode>): ViewRowType {
  return isNavBranch(entry) ? 'branch' : 'leaf';
}
