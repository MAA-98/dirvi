import type { LogicalColor } from './theme.js';

export type HighlightStyle = Readonly<{
  fg?: LogicalColor;
  bg?: LogicalColor;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}>;
