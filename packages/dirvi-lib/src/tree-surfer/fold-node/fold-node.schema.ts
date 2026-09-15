import { z } from 'zod';

import type { FoldNode, FoldNodeRoot } from './fold-node.types.js';

export function createFoldNodeSchemas<Id extends PropertyKey>(
  idSchema: z.ZodType<Id>,
) {
  const foldNodeSchema: z.ZodType<FoldNode<Id>> = z.lazy(() =>
    z.object({
      id: idSchema,

      children: z.array(foldNodeSchema),

      folds: z.array(idSchema).transform((ids) => new Set(ids)),
    }),
  );

  const foldNodeRootSchema: z.ZodType<FoldNodeRoot<Id>> = z.object({
    children: z.array(foldNodeSchema),

    folds: z.array(idSchema).transform((ids) => new Set(ids)),
  });

  return {
    foldNodeSchema,
    foldNodeRootSchema,
  };
}
