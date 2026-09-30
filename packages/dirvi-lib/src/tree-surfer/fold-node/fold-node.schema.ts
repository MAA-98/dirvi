import { z } from 'zod';

import type { SerializableKey } from '../tree-node/tree-node.model.js';
import type { FoldNode } from './fold-node.types.js';

export function createFoldNodeSchemas<Id extends SerializableKey>(
  idSchema: z.ZodType<Id>,
): z.ZodType<FoldNode<Id>> {
  const foldNodeSchema: z.ZodType<FoldNode<Id>> = z.lazy(() =>
    z.object({
      id: idSchema,

      children: z.array(foldNodeSchema),

      foldedChildren: z.array(foldNodeSchema),
    }),
  );

  return foldNodeSchema;
}
