import type { ZodType } from 'zod';
import type { NodePresenter } from './node-presenter.js';

/**
 * Data used by Dirvi to construct the application's root.
 *
 * Dirvi creates the root as a loaded branch using these fields and the
 * direct children returned by `loadChildren([])`.
 */
export type AppRoot<Id, Value> = Readonly<{
  id: Id;
  value: Value;
}>;

/**
 * A direct child returned by an application.
 *
 * Branches start unloaded. Dirvi loads their children when needed.
 * Child IDs must be unique among siblings.
 */
export type AppChild<Id, Value> = Readonly<{
  id: Id;
  value: Value;
  kind: 'leaf' | 'unloaded-branch';
}>;

/**
 * The needed information for dirvi to create an App instance.
 */
export type AppDefinition<Id, Value> = Readonly<{
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
   */
  readonly semanticOrder: boolean;

  /**
   * Validates application tree node data.
   */
  readonly valueSchema: ZodType<Value>;

  /**
   * Loads direct children for the branch addressed by `path`.
   *
   * `path` is relative to the root; `[]` addresses the root. Returned
   * children are in application order and must have unique sibling IDs.
   * Dirvi constructs the corresponding tree nodes.
   */
  readonly loadChildren: (
    path: readonly Id[],
  ) => Promise<readonly AppChild<Id, Value>[]>;

  /**
   * Supplies the application's root ID and value.
   *
   * Dirvi constructs the root as a loaded branch using these fields and
   * the direct children returned by `loadChildren([])`.
   */
  readonly loadRoot: () => Promise<AppRoot<Id, Value>>;

  /**
   * Describes a navigable entry's plain-text content and semantic highlight.
   *
   * Must be synchronous and side-effect-free. The host owns indentation,
   * cursor styling, selection styling, and fold decorations.
   */
  readonly presentNode: NodePresenter<Id, Value>;

  /**
   * Listener for when to reload to add or remove new children in loaded
   * branches.
   */
  readonly subscribeToResync: (listener: () => void) => () => void;
}>;
