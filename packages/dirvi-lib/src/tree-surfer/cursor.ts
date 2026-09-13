export const CursorKind = {
  Entry: 'entry',
  Fold: 'fold',
} as const;

export type CursorKind = (typeof CursorKind)[keyof typeof CursorKind];

export type CursorEntry<Id> = {
  kind: typeof CursorKind.Entry;
  parentPath: readonly Id[];
  entryId: Id;
};

export type CursorFold<Id> = {
  kind: typeof CursorKind.Fold;
  parentPath: readonly Id[];
};

export type Cursor<Id> = CursorEntry<Id> | CursorFold<Id>;

export type CursorApi<Id> = {
  isEntry(cursor: Cursor<Id>): cursor is CursorEntry<Id>;

  isFold(cursor: Cursor<Id>): cursor is CursorFold<Id>;

  equal(left: Cursor<Id>, right: Cursor<Id>): boolean;

  getPath(cursor: Cursor<Id>): Id[] | undefined;

  cursorBelongsToSubtree(cursor: Cursor<Id>, entryPath: readonly Id[]): boolean;
};

export function createCursorApi<Id>(): CursorApi<Id> {
  const cursorApi: CursorApi<Id> = {
    isEntry(cursor): cursor is CursorEntry<Id> {
      return cursor.kind === CursorKind.Entry;
    },

    isFold(cursor): cursor is CursorFold<Id> {
      return cursor.kind === CursorKind.Fold;
    },

    equal(left, right) {
      if (!idPathEqual(left.parentPath, right.parentPath)) {
        return false;
      }

      if (cursorApi.isFold(left)) {
        return cursorApi.isFold(right);
      }

      return cursorApi.isEntry(right) && left.entryId === right.entryId;
    },

    getPath(cursor) {
      if (cursorApi.isFold(cursor)) {
        return undefined;
      }

      return [...cursor.parentPath, cursor.entryId];
    },

    cursorBelongsToSubtree(cursor, entryPath) {
      if (cursorApi.isFold(cursor)) {
        return isStrictPathPrefix(entryPath, cursor.parentPath);
      }

      const cursorPath = [...cursor.parentPath, cursor.entryId];

      return isStrictPathPrefix(entryPath, cursorPath);
    },
  };

  return cursorApi;
}

/**
 * Returns true when both paths contain the same IDs in the same order.
 */
function idPathEqual<Id>(left: readonly Id[], right: readonly Id[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

/**
 * Returns true when `prefix` is a strict prefix of `path`.
 */
function isStrictPathPrefix<Id>(
  prefix: readonly Id[],
  path: readonly Id[],
): boolean {
  if (prefix.length >= path.length) {
    return false;
  }

  for (let index = 0; index < prefix.length; index += 1) {
    if (prefix[index] !== path[index]) {
      return false;
    }
  }

  return true;
}
