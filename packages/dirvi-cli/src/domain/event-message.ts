import { State, TreeNode } from 'dirvi-lib';

export type EventMessage<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> =
  | {
      type: 'view';
      view: State<Name, BufferNode>;
    }
  | {
      type: 'displayed-files-paths';
      paths: string[];
    }
  | {
      type: 'file';
      path: Name[];
    };
