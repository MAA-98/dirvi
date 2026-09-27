import type { SerializableKey, TreeNode, TreeNodeApi } from '../tree-node/tree-node.types.js';
import type { FoldNodeService } from '../fold-node/fold-node.types.js';
import type { CursorApi } from '../cursor.js';
import type { NavNodeApi } from './nav-node.types.js';
export declare function createNavNodeApi<Id extends SerializableKey, Node extends TreeNode<Id, Node>>(treeNodeApi: TreeNodeApi<Id, Node>, foldNodeService: FoldNodeService<Id>, cursorApi: CursorApi<Id>): NavNodeApi<Id, Node>;
//# sourceMappingURL=nav-node.impl.d.ts.map