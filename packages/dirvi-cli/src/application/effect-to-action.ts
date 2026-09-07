import {
  State,
  EffectAction,
  PosixNavNode,
  PosixState,
  PosixNavApi,
  PosixNodeApi,
  PosixNode,
  PosixName,
} from 'dirvi-lib';

import type { ReducerAction } from './reducer-action.js';

export function effectToAction(
  effectAction: EffectAction,
  navigation: PosixNavNode,
  state: PosixState,
): ReducerAction<PosixName, PosixNode> | undefined {
  switch (effectAction.effectActionType) {
    case 'nextEntry': {
      const cursor = PosixNavApi.nextCursor(navigation, state.cursor);

      return cursor === undefined
        ? undefined
        : {
            kind: 'changeCursor',
            cursor,
          };
    }

    case 'prevEntry': {
      const cursor = PosixNavApi.previousCursor(navigation, state.cursor);

      return cursor === undefined
        ? undefined
        : {
            kind: 'changeCursor',
            cursor,
          };
    }

    case 'updateDir':
      return {
        kind: 'updateDir',
        path: effectAction.path,
        entries: effectAction.entries,
      };

    case 'outDir': {
      const cursor = PosixNavApi.parentCursor(navigation, state.cursor);

      return cursor === undefined
        ? undefined
        : {
            kind: 'changeCursor',
            cursor,
          };
    }

    case 'fold': {
      if (state.cursor.kind === 'fold') {
        return undefined;
      }

      const path = [...state.cursor.parentPath, state.cursor.entryName];

      const entry = PosixNodeApi.getAtPath(state.buffer, path);

      if (entry === undefined) {
        return undefined;
      }

      const cursor = PosixNavApi.cursorAfterFold(navigation, state.cursor);
      if (cursor === undefined) {
        return undefined;
      }

      return {
        kind: 'fold',
        parentPath: state.cursor.parentPath,
        entry, // Should be PosixNode
        cursor,
      };
    }

    case 'unfold': {
      if (state.cursor.kind !== 'fold') {
        return undefined;
      }

      const node = PosixNavApi.getNodeAtPath(
        navigation,
        state.cursor.parentPath,
      );

      if (node === undefined || node.foldedEntries.length === 0) {
        return undefined;
      }

      const firstFoldedEntry = node.foldedEntries[0];

      return {
        kind: 'unfold',
        parentPath: state.cursor.parentPath,
        cursor: {
          kind: 'entry',
          parentPath: state.cursor.parentPath,
          entryName: firstFoldedEntry.name,
        },
      };
    }

    case 'toggleFold':
      return effectToAction(
        state.cursor.kind === 'fold'
          ? { effectActionType: 'unfold' }
          : { effectActionType: 'fold' },
        navigation,
        state,
      );
  }
}
