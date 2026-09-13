import {
  CursorApi,
  NavNode,
  SerializableKey,
  State,
  TreeNode,
} from 'dirvi-lib';
import { View, ViewRow } from '../view.js';
import { useRef } from 'react';
import { STATUS_BAR_HEIGHT } from '../components/StatusBar.js';

export type UseView = <
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  navigation: NavNode<Id, BufferNode>,
  state: State<Id, BufferNode>,
  terminalRows: number,
) => View;

// Hooks that keeps Ref of the viewport's start, and returns View sliced to
// only the rows that should be visible.
export function useView<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  navigation: NavNode<Id, BufferNode>,
  state: State<Id, BufferNode>,
  cursorApi: CursorApi<Id>,
  terminalRows: number,
): View {
  const viewportStartRef = useRef(0);

  const viewportHeight = Math.max(1, terminalRows - STATUS_BAR_HEIGHT);

  const rows = View.createRows(navigation, state.cursor, cursorApi);

  viewportStartRef.current = viewportStart(
    rows,
    viewportHeight,
    viewportStartRef.current,
  );

  return View.create(
    navigation,
    state.cursor,
    cursorApi,
    viewportHeight,
    viewportStartRef.current,
  );
}

function viewportStart(
  rows: ViewRow[],
  viewportHeight: number,
  currentViewportStart: number,
): number {
  const scrollMargin = 3;

  const cursorIndex = rows.findIndex((row) => row.cursor);

  const maximumViewportStart = Math.max(0, rows.length - viewportHeight);

  let viewportStart = currentViewportStart;

  if (cursorIndex >= 0) {
    const firstVisibleCursorIndex = viewportStart + scrollMargin;

    const lastVisibleCursorIndex =
      viewportStart + viewportHeight - 1 - scrollMargin;

    if (cursorIndex < firstVisibleCursorIndex) {
      viewportStart = cursorIndex - scrollMargin;
    } else if (cursorIndex > lastVisibleCursorIndex) {
      viewportStart = cursorIndex - viewportHeight + 1 + scrollMargin;
    }
  }

  return Math.max(0, Math.min(viewportStart, maximumViewportStart));
}
