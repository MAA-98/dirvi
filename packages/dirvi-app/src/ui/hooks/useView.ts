import { useRef } from 'react';

import type {
  CursorMethods,
  NavBranch,
  NavMethods,
  State,
  StateMethods,
} from 'dirvi-lib';
import type { NodePresenter } from 'dirvi-apis';
import { View, type ViewRow } from '../view.js';

// Hooks that keeps Ref of the viewport's start, and returns View sliced to
// only the rows that should be visible.
export function useView<Id, Value>(
  navNode: NavBranch<Id, Value>,
  state: State<Id, Value>,
  stateApi: StateMethods<Id, Value>,
  navNodeApi: NavMethods<Id, Value>,
  cursorMethods: CursorMethods<Id>,
  rowCount: number,
  presentNode: NodePresenter<Id, Value>,
): View {
  const viewportStartRef = useRef(0);

  if (rowCount === 0) {
    return { rows: [] };
  }

  const rows = View.createRows(
    navNode,
    navNodeApi,
    stateApi.getCursor(state),
    cursorMethods,
    presentNode,
  );

  viewportStartRef.current = viewportStart(
    rows,
    rowCount,
    viewportStartRef.current,
  );

  return View.create(
    navNode,
    navNodeApi,
    stateApi.getCursor(state),
    cursorMethods,
    rowCount,
    viewportStartRef.current,
    presentNode,
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
