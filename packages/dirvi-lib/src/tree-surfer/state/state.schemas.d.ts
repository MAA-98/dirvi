import { z } from 'zod';
import { SerializableKey, TreeNode } from '../tree-node/tree-node.types.js';
import { State } from './state.types.js';
export declare function createStateSchema<Id extends SerializableKey, Node extends TreeNode<Id, Node>>(rootSchema: z.ZodType<State<Id, Node>['root']>, foldNodeRootSchema: z.ZodType<State<Id, Node>['foldRoot']>, cursorSchema: z.ZodType<State<Id, Node>['cursor']>): z.ZodObject<{
    root: z.ZodType<Node & import("../tree-node/tree-node.types.js").BranchTreeNode<Id, Node>, unknown, z.core.$ZodTypeInternals<Node & import("../tree-node/tree-node.types.js").BranchTreeNode<Id, Node>, unknown>>;
    foldRoot: z.ZodType<import("../index.js").FoldNode<Id>, unknown, z.core.$ZodTypeInternals<import("../index.js").FoldNode<Id>, unknown>>;
    cursor: z.ZodType<import("../cursor.js").Cursor<Id>, unknown, z.core.$ZodTypeInternals<import("../cursor.js").Cursor<Id>, unknown>>;
}, z.core.$strip>;
//# sourceMappingURL=state.schemas.d.ts.map