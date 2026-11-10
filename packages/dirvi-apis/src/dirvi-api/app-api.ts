import type { FeedbackType } from './feedback-type.js';

/**
 * API exposing methods at the dirvi app-level.
 */
export type AppApi = {
  pathAtCursor: () => unknown[];
  visiblePaths: () => unknown[][];
  valueAtCursor: () => unknown;
  addMessage: (message: string, type?: FeedbackType) => void;
};
