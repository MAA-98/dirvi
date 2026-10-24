import { z } from 'zod';

export type NodeCursor<Id> = Readonly<{
  path: readonly Id[];
}>;

export type FoldCursor<Id> = Readonly<{
  parentPath: readonly Id[];
  firstId: Id;
}>;

/**
 * A position in ordered navigation.
 *
 * Node cursors identify real tree nodes. Fold cursors identify a contiguous
 * fold run by its parent path and the ID of its first hidden child.
 */
export type Cursor<Id> = NodeCursor<Id> | FoldCursor<Id>;

/**
 * Creates a schema for ordered-navigation cursors.
 */
export function createCursorSchema<IdSchema extends z.ZodTypeAny>(
  idSchema: IdSchema,
) {
  const pathSchema = z.array(idSchema);

  return z.union([
    z.object({
      path: pathSchema,
    }).strict(),
    z.object({
      parentPath: pathSchema,
      firstId: idSchema,
    }).strict(),
  ]);
}

/**
 * Operations for comparing and inspecting ordered-navigation cursors.
 */
export type CursorApi<Id> = {
  isNodeCursor(cursor: Cursor<Id>): cursor is NodeCursor<Id>;
  isFoldCursor(cursor: Cursor<Id>): cursor is FoldCursor<Id>;
  
  equal(left: Cursor<Id>, right: Cursor<Id>): boolean;

  /**
   * Returns the source-tree path of a node cursor, or the path of the first
   * hidden child represented by a fold cursor.
   */
  getPath(cursor: Cursor<Id>): Id[];

  /**
   * Tests whether the cursor's path is within the subtree at `path`.
   * A fold cursor uses its first hidden child's path as its representative path.
   */
  cursorBelongsToSubtree(cursor: Cursor<Id>, path: readonly Id[]): boolean;
};

export function createCursorApi<Id>(): CursorApi<Id> {
  function isNodeCursor(cursor: Cursor<Id>): cursor is NodeCursor<Id> {
    return 'path' in cursor;
  }

  function isFoldCursor(cursor: Cursor<Id>): cursor is FoldCursor<Id> {
    return !isNodeCursor(cursor);
  }
  
  function getPath(cursor: Cursor<Id>): Id[] {
    return isNodeCursor(cursor)
      ? [...cursor.path]
      : [...cursor.parentPath, cursor.firstId];
  }

  return {
    isNodeCursor,
    isFoldCursor,
    
    equal(left, right) {
      if (isNodeCursor(left)) {
        return isNodeCursor(right) && idPathEqual(left.path, right.path);
      }

      return (
        !isNodeCursor(right) &&
        left.firstId === right.firstId &&
        idPathEqual(left.parentPath, right.parentPath)
      );
    },

    getPath,

    cursorBelongsToSubtree(cursor, path) {
      return isPathPrefix(path, getPath(cursor));
    },
  };
}

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

function isPathPrefix<Id>(prefix: readonly Id[], path: readonly Id[]): boolean {
  if (prefix.length > path.length) {
    return false;
  }

  for (let index = 0; index < prefix.length; index += 1) {
    if (prefix[index] !== path[index]) {
      return false;
    }
  }

  return true;
}
