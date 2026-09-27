import { z } from 'zod';
export function createFoldNodeSchemas(idSchema) {
    const foldNodeSchema = z.lazy(() => z.object({
        id: idSchema,
        children: z.array(foldNodeSchema),
        foldedChildren: z.array(foldNodeSchema),
    }));
    return foldNodeSchema;
}
