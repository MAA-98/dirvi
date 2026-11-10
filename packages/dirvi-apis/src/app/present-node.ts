/**
 * A semantic highlight name, not a concrete terminal color.
 *
 * Dot-separated names allow fallback to broader categories:
 * "branch.unloaded" can fall back to "branch".
 */
export type HighlightToken = string;

export type PresentNode<Id, Value> = (
  id: Id,
  value: Value,
  isBranch: boolean,
) => Readonly<{
  content: string;
  highlight: HighlightToken;
}>;
