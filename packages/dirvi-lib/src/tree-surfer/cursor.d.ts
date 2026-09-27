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
export declare function createCursorSchema<IdSchema extends z.ZodTypeAny>(idSchema: IdSchema): z.ZodArray<IdSchema>;
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
export declare function createCursorApi<Id>(): CursorApi<Id>;
//# sourceMappingURL=cursor.d.ts.map