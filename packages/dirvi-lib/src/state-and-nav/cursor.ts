import { z } from 'zod';

/**
 * A root-relative path identifying the current tree position.
 *
 * The empty path identifies the tree root. A non-empty path identifies a
 * descendant by following child IDs from the root.
 *
 * For example, given:
 *
 * ```
 * root
 * └── src
 *     └── main.ts
 * ```
 *
 * the cursors are:
 *
 * ```ts
 * { path: [] }                              // root
 * { path: ['src'] }                         // src
 * { path: ['src', 'main.ts'] }              // main.ts
 * ```
 *
 * @typeParam Id - The type of node IDs.
 */
export type NodeCursor<Id> = Readonly<{
  path: readonly Id[];
}>;

/**
 * Fold cursors identify a contiguous fold run by its parent path and the ID of
 * its first hidden child.
 */
export type FoldCursor<Id> = Readonly<{
  parentPath: readonly Id[];
  firstId: Id;
}>;

/**
 * A position in navigation.
 *
 * Unordered navigation uses node cursors only. Ordered navigation may also
 * use fold cursors to identify inline fold blocks.
 */
export type Cursor<Id> = NodeCursor<Id> | FoldCursor<Id>;

/**
 * Creates a schema for cursors.
 *
 * The schema validates the IDs in the path using the param, but does not verify
 * that the path exists in a particular tree.
 *
 * @typeParam IdSchema - type passed on so the parsed output can include `Id`
 * type.
 * @param idSchema - schema for the `Id` type.
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
 * Operations for comparing and inspecting cursors.
 *
 * @typeParam Id - The type of node IDs.
 */
export type CursorMethods<Id> = {
  isNodeCursor(cursor: Cursor<Id>): cursor is NodeCursor<Id>;
  isFoldCursor(cursor: Cursor<Id>): cursor is FoldCursor<Id>;

  /**
   * Tests whether two cursors identify the same tree position.
   */
  equal(left: Cursor<Id>, right: Cursor<Id>): boolean;

  /**
   * Returns a mutable copy of the path to the cursor, returning the path of the
   * first hidden child represented by a fold cursor.
   *
   * The empty path identifies the tree root.
   */
  getPath(cursor: Cursor<Id>): Id[];

  /**
   * Tests whether the cursor's path is within the subtree at `path`.
   * A fold cursor uses its first hidden child's path as its representative path.
   *
   * The subtree includes the node at `path` itself. Therefore, equal
   * paths return `true`, and an empty `path` contains every cursor.
   */
  cursorBelongsToSubtree(cursor: Cursor<Id>, path: readonly Id[]): boolean;
};

export function createCursorMethods<Id>(): CursorMethods<Id> {
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
        isFoldCursor(right) &&
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

/**
 * Returns true when both root-relative paths contain the same IDs in the same
 * order.
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
 * Returns true when `prefix` is a prefix of `path`.
 *
 * Equal paths are included. An empty prefix is therefore a prefix of every
 * path.
 */
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
