import type { InputModeState } from './input-mode-state.js';
import type { SerializableKey, TreeNode } from '../../tree-surfer/index.js';

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
      effectType: 'peekFold';
      parentPath: readonly Id[];
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
      effectType: 'quit';
      exitMessage: string;
    }>
  | Readonly<{
      effectType: 'setInputState';
      inputState: InputModeState;
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
      effectActionType: 'fold';
    }>
  | Readonly<{
      effectActionType: 'unfold';
    }>;
