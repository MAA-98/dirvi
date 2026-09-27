import type { SerializableKey, TreeNode, TreeNodeApi } from './tree-node.types.js';
/**
 * Creates an API for inspecting and immutably updating tree nodes (of the
 * given types).
 *
 * Tree updates do not mutate the supplied forest or its nodes. Updated
 * arrays and ancestor nodes are created as needed, while unrelated nodes
 * retain their original object identity.
 *
 * Node IDs are compared using JavaScript value equality. Sibling IDs
 * should be unique.
 */
export declare function createTreeNodeApi<Id extends SerializableKey, Node extends TreeNode<Id, Node>>(): TreeNodeApi<Id, Node>;
//# sourceMappingURL=tree-node.impl.d.ts.map