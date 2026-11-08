import { SerializableKey } from './key.js';

/**
 * A semantic highlight name, not a concrete terminal color.
 *
 * Dot-separated names allow fallback to broader categories:
 * "filesystem.directory" can fall back to "filesystem".
 */
export type HighlightToken = string;

export type PresentNode<Id extends SerializableKey, Value> = (
  id: Id,
  value: Value,
  isBranch: boolean,
) => Readonly<{
  content: string;
  highlight: HighlightToken;
}>;
