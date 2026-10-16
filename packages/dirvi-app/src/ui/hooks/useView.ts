import { useRef } from 'react';

import type {
  CursorApi,
  NavBranch,
  NavNodeApi,
  SerializableKey,
  State,
} from 'dirvi-lib';
import { View, type ViewRow } from '../view.js';

const STATUS_BAR_HEIGHT = 1;

// Hooks that keeps Ref of the viewport's start, and returns View sliced to
// only the rows that should be visible.
export function useView<Id extends SerializableKey, Value>(
  navNode: NavBranch<Id>,
  state: State<Id, Value>,
  navNodeApi: NavNodeApi<Id, Value>,
  cursorApi: CursorApi<Id>,
  rowCount: number,
): View {
  const viewportStartRef = useRef(0);
  const viewportHeight = Math.max(
    0,
    rowCount - STATUS_BAR_HEIGHT,
  );

  if (viewportHeight === 0) {
    return { rows: [] };
  }

  const rows = View.createRows(navNode, navNodeApi, state.cursor, cursorApi);

  viewportStartRef.current = viewportStart(
    rows,
    viewportHeight,
    viewportStartRef.current,
  );

  return View.create(
    navNode,
    navNodeApi,
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
