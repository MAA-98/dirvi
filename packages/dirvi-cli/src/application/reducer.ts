import { FoldNodeApi, FoldNodeService, State, TreeNode, TreeNodeApi } from 'dirvi-lib';
import { ReducerAction } from './reducer-action.js';

export type Reducer<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = (
  state: State<Name, BufferNode>,
  action: ReducerAction<Name, BufferNode>,
) => State<Name, BufferNode>;

export function createReducer<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Name, BufferNode>,
  foldNodeService: FoldNodeService<Name>,
): Reducer<Name, BufferNode> {
  return (state, action) => {
    switch (action.kind) {
      case 'changeCursor':
        return {
          ...state,
          cursor: action.cursor,
        };

      case 'updateBranch':
        const buffer = treeNodeApi.modifyAtPath(
          state.buffer,
          action.path,
          (node) => {
            // A branch update cannot turn a leaf into a branch.
            if (!treeNodeApi.isBranch(node)) {
              return undefined;
            }

            return {
              ...node,
              branches: action.entries,
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

      case 'updateBuffer':
        // A newer update has already been applied.
        if (state.buffer !== action.oldEntries) {
          return state;
        }

        return {
          ...state,
          buffer: action.entries,
        };

      case 'fold': {
        const foldNode = foldNodeService.addFoldedEntryAtPath(
          state.foldNode,
          action.parentPath,
          action.entry.name,
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
