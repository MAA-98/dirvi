import { NameEquals, nameSeqEqual } from './tree-node.js';

export const CursorKind = {
  Entry: 'entry',
  Fold: 'fold',
} as const;

export type CursorKind = (typeof CursorKind)[keyof typeof CursorKind];

export type CursorEntry<Name> = {
  kind: typeof CursorKind.Entry;
  parentPath: Name[];
  entryName: Name;
};

export type CursorFold<Name> = {
  kind: typeof CursorKind.Fold;
  parentPath: Name[];
};

export type Cursor<Name> = CursorEntry<Name> | CursorFold<Name>;

export type CursorApi<Name> = {
  isEntry(cursor: Cursor<Name>): cursor is CursorEntry<Name>;

  isFold(cursor: Cursor<Name>): cursor is CursorFold<Name>;

  equal(first: Cursor<Name>, second: Cursor<Name>): boolean;

  getPath(cursor: Cursor<Name>): Name[] | undefined;

  cursorBelongsToSubtree(cursor: Cursor<Name>, entryPath: Name[]): boolean;
};

export function createCursorApi<Name extends {}>(
  nameEquals: NameEquals<Name>,
): CursorApi<Name> {
  const cursorApi: CursorApi<Name> = {
    isEntry(cursor): cursor is CursorEntry<Name> {
      return cursor.kind === CursorKind.Entry;
    },

    isFold(cursor): cursor is CursorFold<Name> {
      return cursor.kind === CursorKind.Fold;
    },

    equal(left, right) {
      if (!nameSeqEqual(left.parentPath, right.parentPath, nameEquals)) {
        return false;
      }

      if (cursorApi.isFold(left)) {
        return cursorApi.isFold(right);
      }

      return (
        cursorApi.isEntry(right) && nameEquals(left.entryName, right.entryName)
      );
    },

    getPath(cursor) {
      if (cursorApi.isFold(cursor)) {
        return undefined;
      }

      return [...cursor.parentPath, cursor.entryName];
    },

    cursorBelongsToSubtree(cursor, entryPath) {
      if (cursorApi.isFold(cursor)) {
        return isStrictPathPrefix(entryPath, cursor.parentPath, nameEquals);
      }

      const cursorPath = [...cursor.parentPath, cursor.entryName];

      return isStrictPathPrefix(entryPath, cursorPath, nameEquals);
    },
  };

  return cursorApi;
}

function isStrictPathPrefix<Name extends {}>(
  prefix: Name[],
  path: Name[],
  nameEquals: NameEquals<Name>,
): boolean {
  if (prefix.length >= path.length) {
    return false;
  }

  return nameSeqEqual(prefix, path.slice(0, prefix.length), nameEquals);
}
