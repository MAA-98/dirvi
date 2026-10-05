import type { InputModeState } from './input-mode-state.js';
import type { SerializableKey, TreeNode } from '../../trees/index.js';

/**
 * An effect produced by interpreting an intent against the current state.
 *
 * @typeParam Id - The sibling-unique tree-node ID type.
 * @typeParam Value - Application-owned data stored in each tree node.
 */
export type Effect<Id extends SerializableKey, Value> =
  | Readonly<{
      effectType: 'dispatchEffectAction';
      action: EffectAction<Id, Value>;
    }>
  | Readonly<{
      effectType: 'loadBranchEntries';
      path: readonly Id[];
    }>
  | Readonly<{
      effectType: 'saveView';
      name: string;
      overwrite: boolean;
    }>
  | Readonly<{
      effectType: 'loadView';
      name: string;
    }>
  | Readonly<{
      effectType: 'emitVisibleLeavesPaths';
    }>
  | Readonly<{
      effectType: 'listFolds';
    }>
  | Readonly<{
      effectType: 'quit';
      exitMessage: string;
    }>
  | Readonly<{
      effectType: 'setInputState';
      inputState: InputModeState;
    }>
  | Readonly<{
      effectType: 'unrecognizedCommand';
      commandLine: string;
    }>;

/**
 * A user-facing reference to a fold tree.
 *
 * Indexes are local to a view and may be reused after deletion. Names are
 * durable references intended for command-line use.
 */
export type FoldTreeReference =
  | Readonly<{
      foldTreeReferenceType: 'index';
      index: number;
    }>
  | Readonly<{
      foldTreeReferenceType: 'name';
      name: string;
    }>;

/**
 * An action interpreted by the state reducer.
 *
 * @typeParam Id - The sibling-unique tree-node ID type.
 * @typeParam Value - Application-owned data stored in each tree node.
 */
export type EffectAction<Id extends SerializableKey, Value> =
  | Readonly<{
      effectActionType: 'nextEntry';
    }>
  | Readonly<{
      effectActionType: 'prevEntry';
    }>
  | Readonly<{
      effectActionType: 'setBranchEntries';
      path: readonly Id[];
      entries: readonly TreeNode<Id, Value>[] | null;
    }>
  | Readonly<{
      effectActionType: 'navigateToParent';
    }>
  | Readonly<{
      effectActionType: 'addToFoldTree';
      foldTree: FoldTreeReference;
    }>
  | Readonly<{
      effectActionType: 'removeFromFoldTree';
      foldTree: FoldTreeReference;
    }>
  | Readonly<{
      effectActionType: 'fold';
      foldTree: FoldTreeReference;
    }>
  | Readonly<{
      effectActionType: 'unfold';
      foldTree: FoldTreeReference;
    }>
  | Readonly<{
      effectActionType: 'toggleFold';
      foldTree: FoldTreeReference;
    }>
  | Readonly<{
      effectActionType: 'createFoldTree';
      name: string;
    }>;
