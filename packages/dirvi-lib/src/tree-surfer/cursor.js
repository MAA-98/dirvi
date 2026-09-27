import { z } from 'zod';
/**
 * Creates a schema for root-relative tree cursors.
 *
 * The schema validates the IDs in the path, but does not verify that the path
 * exists in a particular tree.
 */
export function createCursorSchema(idSchema) {
    return z.array(idSchema);
}
export function createCursorApi() {
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
function idPathEqual(left, right) {
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
function isPathPrefix(prefix, path) {
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
