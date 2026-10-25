import type {
  SerializableKey,
  TreeNode,
  TreeMethods,
  PresentNode,
} from 'dirvi-lib';
import type { ZodType } from 'zod';

/**
 * The needed information for creating an `AppApi`.
 */
export type AppDefinition<Id extends SerializableKey, Value> = Readonly<{
  /**
   * User-facing application name shown by the host.
   */
  readonly displayName: string;

  /**
   * Useful at times.
   */
  readonly rootId: Id;
  
  /**
   * Whether sibling order is meaningful in the application's underlying
   * structure, rather than merely a presentation choice.
   *
   * When true, the view preserves sibling order and represents contiguous
   * runs of folded siblings with navigable, in-place fold markers.
   *
   * When false, folded children are summarized on their parent without
   * introducing separate navigable fold markers. Visible siblings still
   * have a presentation order.
   *
   * Applies to the entire application.
   */
  readonly semanticOrder: boolean;

  /**
   * Validates application tree node data.
   */
  readonly idSchema: ZodType<Id>;
  readonly valueSchema: ZodType<Value>;

  /**
   * Creates the application's root node.
   *
   * Invariant: the returned node is an open branch. That invariant is checked
   * when an initial State is created.
   */
  readonly createRoot: (
    treeNodeApi: TreeMethods<Id, Value>,
  ) => Promise<TreeNode<Id, Value>>;

  /**
   * Loads direct children for the branch addressed by `path`.
   *
   * Returned nodes must be opaque tree values created or decoded through this
   * application's TreeNodeApi specialization.
   */
  readonly loadChildren: (
    treeNodeApi: TreeMethods<Id, Value>,
    path: readonly Id[],
  ) => Promise<readonly TreeNode<Id, Value>[]>;

  /**
   * Describes a navigable entry's plain-text content and semantic highlight.
   *
   * Must be synchronous and side-effect-free. The host owns indentation,
   * cursor styling, selection styling, and fold decorations.
   */
  readonly presentNode: PresentNode<Id>;

  /**
   * Listener for when to reload to add or remove new children in loaded
   * branches.
   */
  readonly subscribeToResync: (listener: () => void) => () => void;
}>;
