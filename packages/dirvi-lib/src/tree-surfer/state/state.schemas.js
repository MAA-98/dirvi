import { z } from 'zod';
export function createStateSchema(rootSchema, foldNodeRootSchema, cursorSchema) {
    return z.object({
        root: rootSchema,
        foldRoot: foldNodeRootSchema,
        cursor: cursorSchema,
    });
}
