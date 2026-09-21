import { z } from 'zod';

export type Cursor<Id> = {
  parentPath: readonly Id[];
  entryId: Id;
};

export function createCursorSchema<IdSchema extends z.ZodTypeAny>(
  idSchema: IdSchema,
) {
  const parentPathSchema = z.array(idSchema);

  return z.object({
    parentPath: parentPathSchema,
    entryId: idSchema,
  })
}

export type CursorApi<Id> = {
  equal(left: Cursor<Id>, right: Cursor<Id>): boolean;

  getPath(cursor: Cursor<Id>): Id[];

  cursorBelongsToSubtree(cursor: Cursor<Id>, entryPath: readonly Id[]): boolean;
};

export function createCursorApi<Id>(): CursorApi<Id> {
  return {
    equal(left, right) {
      return (
        idPathEqual(left.parentPath, right.parentPath) &&
        left.entryId === right.entryId
      );
    },

    getPath(cursor) {
      return [...cursor.parentPath, cursor.entryId];
    },

    cursorBelongsToSubtree(cursor, entryPath) {
      const cursorPath = [...cursor.parentPath, cursor.entryId];

      return isStrictPathPrefix(entryPath, cursorPath);
    },
  };
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
