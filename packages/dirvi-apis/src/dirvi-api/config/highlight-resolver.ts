import type { LogicalColor } from './theme.js';

/** Returns undefined when the token is not recognized. */
export type HighlightResolver = (token: string) => HighlightStyle | undefined;

export type HighlightStyle = Readonly<{
  fg?: LogicalColor;
  bg?: LogicalColor;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}>;
