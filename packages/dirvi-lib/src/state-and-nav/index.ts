export type { SerializableKey } from './tree/index.js';

// Opaque types
// Used for passing data without exposing internals
export type { TreeNode } from './tree/index.js';
export type { Folds } from './fold-node/index.js';
export type { Cursor } from './cursor.js';
// Methods inside State
export type { TreeMethods } from './tree/index.js';
export { createTreeMethods } from './tree/index.js';
export type { FoldIndex, FoldMethods } from './fold-node/index.js';
export { createFoldMethods } from './fold-node/index.js';
export type { CursorMethods } from './cursor.js';
export { createCursorMethods } from './cursor.js';

// Main products of module:
// State
export type { State, StateApi } from './state/state.types.js';
export { createStateApi } from './state/state.impl.js';
// Navigation
export type { NavNode, NavMethods, NavBranch } from './nav/nav.types.js';
export { createOrderedNavMethods } from './nav/nav.ordered.impl.js';
export { createUnorderedNavMethods } from './nav/nav.unordered.impl.js';