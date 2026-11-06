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
export type ColorConfig = {
  hex?: string | undefined;
  ansi256?: number | undefined;
  basic?: BasicColorName | undefined;
};

export type ForegroundHighlightConfig = {
  fg: ColorConfig;
};

export type OptionalForegroundHighlightConfig = {
  fg?: ColorConfig | undefined;
};

export type BackgroundHighlightConfig = {
  bg: ColorConfig;
};

export type ForegroundBackgroundHighlightConfig = {
  fg: ColorConfig;
  bg: ColorConfig;
};

/** Resolved theme used to render Dirvi's interface. */
export type Theme = {
  statusBar: {
    command: ForegroundHighlightConfig;
    normal: ForegroundHighlightConfig;
    background: BackgroundHighlightConfig;
  };
  tree: {
    leaf: ForegroundHighlightConfig;
    branch: ForegroundHighlightConfig;
    folded: ForegroundHighlightConfig;
    cursorLine: BackgroundHighlightConfig;
    indentGuide: OptionalForegroundHighlightConfig;
  };
  feedbackBar: {
    message: ForegroundBackgroundHighlightConfig;
    success: ForegroundBackgroundHighlightConfig;
    error: ForegroundBackgroundHighlightConfig;
  };
};
