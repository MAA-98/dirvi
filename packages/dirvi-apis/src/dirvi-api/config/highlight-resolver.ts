import type { LogicalColor } from './theme.js';

/**
 * Returns undefined when the token is not recognized.
 * An empty style {} would mean “recognized, with no explicit styling,” while
 * undefined means “not resolved.”
 */
export type HighlightResolver = (token: string) => HighlightStyle | undefined;

export type HighlightStyle = Readonly<{
  fg?: LogicalColor;
  bg?: LogicalColor;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}>;
