import { z } from 'zod';
import { SerializableKey, TreeNode } from '../tree-node/tree-node.types.js';
import { State, StateRoot } from './state.types.js';

export function createStateSchema<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(
  nodeSchema: z.ZodType<StateRoot<Id, Node>>,
  foldNodeRootSchema: z.ZodType<State<Id, Node>['foldRoot']>,
  cursorSchema: z.ZodType<State<Id, Node>['cursor']>,
) {
  return z.object({
    root: nodeSchema,
    foldRoot: foldNodeRootSchema,
    cursor: cursorSchema,
  });
}
