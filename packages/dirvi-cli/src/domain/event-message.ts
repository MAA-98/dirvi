import { SerializableKey, State, TreeNode } from 'dirvi-lib';

export type EventMessage<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> =
  | {
      type: 'view';
      view: State<Id, BufferNode>;
    }
  | {
      type: 'displayed-leaves-paths';
      paths: Id[][];
    }
  | {
      type: 'file';
      path: Id[];
    };
