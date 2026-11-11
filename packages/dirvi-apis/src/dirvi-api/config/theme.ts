/**
 * Named ANSI foreground colors supported by Dirvi themes.
 *
 * Renderers translate these names into their own color APIs.
 */
export type BasicColorName =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'cyan'
  | 'magenta'
  | 'white'
  // Common aliases for blackBright.
  | 'gray'
  | 'grey'
  | 'blackBright'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'cyanBright'
  | 'magentaBright'
  | 'whiteBright';

/**
 * Terminal color profiles for the same logical color.
 *
 * At least one profile must be provided; the runtime schema enforces this.
 */
export type LogicalColor = {
  hex?: string | undefined;
  ansi256?: number | undefined;
  basic?: BasicColorName | undefined;
};

export type FgHlConfig = {
  fg: LogicalColor;
};

export type OptionalFgHlConfig = {
  fg?: LogicalColor | undefined;
};

export type BgHlConfig = {
  bg: LogicalColor;
};

export type FgAndBgHlConfig = {
  fg: LogicalColor;
  bg: LogicalColor;
};

/** Resolved theme used to render Dirvi's interface. */
export type Theme = {
  statusBar: {
    command: FgHlConfig;
    normal: FgHlConfig;
    background: BgHlConfig;
  };
  tree: {
    leaf: FgHlConfig;
    branch: FgHlConfig;
    folded: FgHlConfig;
    cursorLine: BgHlConfig;
    indentGuide: OptionalFgHlConfig;
  };
  feedbackBar: {
    message: FgAndBgHlConfig;
    success: FgAndBgHlConfig;
    error: FgAndBgHlConfig;
  };
};
