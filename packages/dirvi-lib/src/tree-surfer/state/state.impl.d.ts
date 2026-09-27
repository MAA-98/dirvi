import { SerializableKey, TreeNode, TreeNodeApi } from '../tree-node/tree-node.types.js';
import { FoldNodeApi } from '../fold-node/fold-node.types.js';
import { CursorApi } from '../cursor.js';
import { NavNodeApi } from '../nav-node/nav-node.types.js';
import { StateApi } from './state.types.js';
export declare function createStateApi<Id extends SerializableKey, Node extends TreeNode<Id, Node>>(treeNodeApi: TreeNodeApi<Id, Node>, foldNodeApi: FoldNodeApi<Id>, cursorApi: CursorApi<Id>, navNodeApi: NavNodeApi<Id, Node>): StateApi<Id, Node>;
//# sourceMappingURL=state.impl.d.ts.map