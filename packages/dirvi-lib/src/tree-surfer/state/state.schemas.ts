import { z } from 'zod';
import { SerializableKey, TreeNode } from '../tree-node/tree-node.types.js';
import { State } from './state.types.js';

export function createStateSchema<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(
  rootSchema: z.ZodType<State<Id, Node>['root']>,
  foldNodeRootSchema: z.ZodType<State<Id, Node>['foldRoot']>,
  cursorSchema: z.ZodType<State<Id, Node>['cursor']>,
) {
  return z.object({
    root: rootSchema,
    foldRoot: foldNodeRootSchema,
    cursor: cursorSchema,
  });
}
