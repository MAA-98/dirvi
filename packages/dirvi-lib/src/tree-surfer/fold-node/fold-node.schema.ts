import { z } from 'zod';

import type { FoldNode } from './fold-node.types.js';
import { SerializableKey } from '../tree-node/tree-node.types.js';

export function createFoldNodeSchemas<Id extends SerializableKey>(
  idSchema: z.ZodType<Id>,
): z.ZodType<FoldNode<Id>> {
  const foldNodeSchema: z.ZodType<FoldNode<Id>> = z.lazy(() =>
    z.object({
      id: idSchema,

      children: z.array(foldNodeSchema),

      folds: z.array(idSchema).transform((ids) => new Set(ids)),
    }),
  );
  
  return foldNodeSchema;
}
