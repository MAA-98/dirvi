import {
  FoldNodeService,
  SerializableKey,
  State,
  TreeNode,
  TreeNodeApi,
} from 'dirvi-lib';
import { ReducerAction } from './reducer-action.js';

export type Reducer<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = (
  state: State<Id, BufferNode>,
  action: ReducerAction<Id, BufferNode>,
) => State<Id, BufferNode>;

export function createReducer<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(
  treeNodeApi: TreeNodeApi<Id, Node>,
  foldNodeService: FoldNodeService<Id>,
): Reducer<Id, Node> {
  return (state, action) => {
    switch (action.kind) {
      case 'changeCursor':
        return {
          ...state,
          cursor: action.cursor,
        };

      case 'updateBranch':
        const root = treeNodeApi.modifyAtPath(
          state.root,
          action.path,
          (node) => {
            // A branch update cannot turn a leaf into a branch.
            if (!treeNodeApi.isBranch(node)) {
              return undefined;
            }

            return {
              ...node,
              children: action.entries,
            } as Node;
          },
        );

        if (root === undefined) {
          return state;
        }

        return {
          ...state,
          root,
        };

      case 'setState': {
        // A newer update has already been applied.
        if (state !== action.oldState) {
          return state;
        }

        return {
          ...action.newState,
        };
      }

      case 'fold': {
        const entryId = action.path.at(-1);

        if (entryId === undefined) {
          return state;
        }

        const parentPath = action.path.slice(0, -1);
        
        const foldRoot = foldNodeService.addFoldedEntryAtPath(
          state.foldRoot,
          parentPath,
          entryId,
        );

        /*
         * addFoldedEntryAtPath creates missing fold paths, so this should
         * normally never be undefined. Preserve the existing state if it is.
         */
        if (foldRoot === undefined) {
          return state;
        }

        return {
          ...state,
          foldRoot,
          cursor: action.cursor,
        };
      }

      case 'unfold': {
        const foldRoot = foldNodeService.clearFoldedEntriesAtPath(
          state.foldRoot,
          action.path,
        );

        /*
         * Unlike adding a fold, clearing only operates on an existing path.
         * An undefined result means that the fold path no longer exists.
         */
        if (foldRoot === undefined) {
          return state;
        }

        return {
          ...state,
          foldRoot,
          cursor: action.cursor,
        };
      }
    }
  };
}
