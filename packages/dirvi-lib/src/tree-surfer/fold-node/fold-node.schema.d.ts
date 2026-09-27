import { z } from 'zod';
import type { FoldNode } from './fold-node.types.js';
import { SerializableKey } from '../tree-node/tree-node.types.js';
export declare function createFoldNodeSchemas<Id extends SerializableKey>(idSchema: z.ZodType<Id>): z.ZodType<FoldNode<Id>>;
//# sourceMappingURL=fold-node.schema.d.ts.map