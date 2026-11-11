/**
 * A highlight group name, typically a Tree-sitter syntax capture group
 * such as "@tag" or "@comment".
 */
export type HighlightToken = string;

export type HighlightSpan = Readonly<{
  content: string;
  highlight: HighlightToken;
}>;

export type NodeKind = 'leaf' | 'unloaded-branch' | 'loaded-branch';

export type NodePresenter<Id, Value> = (
  id: Id,
  value: Value,
  nodeKind: NodeKind,
) => readonly HighlightSpan[];
