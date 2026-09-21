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
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Id, BufferNode>,
  foldNodeService: FoldNodeService<Id>,
): Reducer<Id, BufferNode> {
  return (state, action) => {
    switch (action.kind) {
      case 'changeCursor':
        return {
          ...state,
          cursor: action.cursor,
        };

      case 'updateBranch':
        const buffer = treeNodeApi.modifyAtPath(
          state.root.children,
          action.path,
          (node) => {
            // A branch update cannot turn a leaf into a branch.
            if (!treeNodeApi.isBranch(node)) {
              return undefined;
            }

            return {
              ...node,
              children: action.entries,
            } as BufferNode;
          },
        );

        if (buffer === undefined) {
          return state;
        }

        return {
          ...state,
          buffer,
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
        const foldNode = foldNodeService.addFoldedEntryAtPath(
          state.foldNode,
          action.parentPath,
          action.entry.id,
        );

        /*
         * addFoldedEntryAtPath creates missing fold paths, so this should
         * normally never be undefined. Preserve the existing state if it is.
         */
        if (foldNode === undefined) {
          return state;
        }

        return {
          ...state,
          foldNode,
          cursor: action.cursor,
        };
      }

      case 'unfold': {
        const foldNode = foldNodeService.clearFoldedEntriesAtPath(
          state.foldNode,
          action.parentPath,
        );

        /*
         * Unlike adding a fold, clearing only operates on an existing path.
         * An undefined result means that the fold path no longer exists.
         */
        if (foldNode === undefined) {
          return state;
        }

        return {
          ...state,
          foldNode,
          cursor: action.cursor,
        };
      }
    }
  };
}
