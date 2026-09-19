import { z } from 'zod';
import { SerializableKey, TreeNode } from '../tree-node/tree-node.types.js';
import { State } from './state.types.js';

export function createStateSchema<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(
  bufferNodeSchema: z.ZodType<Node>,
  foldNodeRootSchema: z.ZodType<State<Id, Node>['foldNode']>,
  cursorSchema: z.ZodType<State<Id, Node>['cursor']>,
) {
  return z.object({
    buffer: z.array(bufferNodeSchema),
    foldNode: foldNodeRootSchema,
    cursor: cursorSchema,
  });
}
