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
 * []                    // root
 * ['src']               // src
 * ['src', 'main.ts']    // main.ts
 * ```
 *
 * @typeParam Id - The type of node IDs.
 */
export type Cursor<Id> = readonly Id[];

/**
 * Creates a schema for root-relative tree cursors.
 *
 * The schema validates the IDs in the path, but does not verify that the path
 * exists in a particular tree.
 */
export function createCursorSchema<IdSchema extends z.ZodTypeAny>(
  idSchema: IdSchema,
) {
  return z.array(idSchema);
}

/**
 * Operations for comparing and inspecting root-relative tree cursors.
 *
 * @typeParam Id - The type of node IDs.
 */
export type CursorApi<Id> = {
  /**
   * Tests whether two cursors identify the same tree position.
   */
  equal(left: Cursor<Id>, right: Cursor<Id>): boolean;

  /**
   * Returns a mutable copy of the cursor path.
   *
   * The empty path identifies the tree root.
   */
  getPath(cursor: Cursor<Id>): Id[];

  /**
   * Tests whether the cursor is within the subtree at `entryPath`.
   *
   * The subtree includes the node at `entryPath` itself. Therefore, equal
   * paths return `true`, and an empty `entryPath` contains every cursor.
   */
  cursorBelongsToSubtree(cursor: Cursor<Id>, entryPath: readonly Id[]): boolean;
};

export function createCursorApi<Id>(): CursorApi<Id> {
  return {
    equal(left, right) {
      return idPathEqual(left, right);
    },

    getPath(cursor) {
      return [...cursor];
    },

    cursorBelongsToSubtree(cursor, entryPath) {
      return isPathPrefix(entryPath, cursor);
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
function isPathPrefix<Id>(
  prefix: readonly Id[],
  path: readonly Id[],
): boolean {
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
