import type { FeedbackType } from './feedback-type.js';
import type { SerializableKey } from '../app/index.js';

/**
 * API exposing methods at the dirvi app-level.
 */
export type AppApi = {
  pathAtCursor: () => SerializableKey[];
  visiblePaths: () => SerializableKey[][];
  valueAtCursor: () => unknown;
  addMessage: (message: string, type?: FeedbackType) => void;
};
