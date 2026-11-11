import { z } from 'zod';
import type {
  BgHlConfig,
  BasicColorName,
  LogicalColor,
  FgAndBgHlConfig,
  FgHlConfig,
  OptionalFgHlConfig,
  Theme,
} from 'dirvi-apis';

// =============================================================================
// Colors: Schemas
// =============================================================================

/** Named ANSI colors accepted by the theme schema. */
export const basicColorNames = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'cyan',
  'magenta',
  'white',

  // Common aliases for blackBright.
  'gray',
  'grey',

  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'cyanBright',
  'magentaBright',
  'whiteBright',
] as const satisfies readonly BasicColorName[];

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, {
  message: 'Expected a #rrggbb color',
});

const Ansi256ColorSchema = z.number().int().min(0).max(255);

const BasicColorSchema = z.enum(basicColorNames);

export const ColorConfigSchema = z
  .object({
    hex: HexColorSchema.optional(),
    ansi256: Ansi256ColorSchema.optional(),
    basic: BasicColorSchema.optional(),
  })
  .refine(
    (value) =>
      value.hex !== undefined ||
      value.ansi256 !== undefined ||
      value.basic !== undefined,
    {
      message: 'Expected at least one terminal color profile',
    },
  ) satisfies z.ZodType<LogicalColor>;

// =============================================================================
// Highlights: Schemas
// =============================================================================
// These schemas are intentionally non-strict.

export const ForegroundHighlightConfigSchema = z.object({
  fg: ColorConfigSchema,
}) satisfies z.ZodType<FgHlConfig>;

export const OptionalForegroundHighlightConfigSchema = z.object({
  fg: ColorConfigSchema.optional(),
}) satisfies z.ZodType<OptionalFgHlConfig>;

export const BackgroundHighlightConfigSchema = z.object({
  bg: ColorConfigSchema,
}) satisfies z.ZodType<BgHlConfig>;

export const ForegroundBackgroundHighlightConfigSchema = z.object({
  fg: ColorConfigSchema,
  bg: ColorConfigSchema,
}) satisfies z.ZodType<FgAndBgHlConfig>;

// =============================================================================
// Theme defaults
// =============================================================================

const black: LogicalColor = {
  hex: '#28282a',
  ansi256: 235,
  basic: 'black',
};

const lightGray: LogicalColor = {
  hex: '#eaeaec',
  ansi256: 254,
  basic: 'gray',
};

const leaf: LogicalColor = {
  hex: '#e5e5e5',
  ansi256: 254,
  basic: 'white',
};

const branch: LogicalColor = {
  hex: '#2472c8',
  ansi256: 26,
  basic: 'blue',
};

const folded: LogicalColor = {
  hex: '#808080',
  ansi256: 245,
  basic: 'gray',
};

const indentGuide: LogicalColor = {
  hex: '#808080',
  ansi256: 245,
  basic: 'gray',
};

const cursorLine: LogicalColor = {
  hex: '#3a3a3c',
  ansi256: 237,
  basic: 'gray',
};

const success: LogicalColor = {
  hex: '#238c4b',
  ansi256: 28,
  basic: 'green',
};

const error: LogicalColor = {
  hex: '#be2d2d',
  ansi256: 160,
  basic: 'red',
};

const themeDefaults = {
  statusBar: {
    command: { fg: black },
    normal: { fg: black },
    background: { bg: lightGray },
  },
  tree: {
    leaf: { fg: leaf },
    branch: { fg: branch },
    folded: { fg: folded },
    cursorLine: { bg: cursorLine },
    indentGuide: { fg: indentGuide },
  },
  feedbackBar: {
    message: {
      fg: black,
      bg: lightGray,
    },
    success: {
      fg: success,
      bg: lightGray,
    },
    error: {
      fg: error,
      bg: lightGray,
    },
  },
};

// =============================================================================
// Theme: Schema
// =============================================================================

export const ThemeSchema = z.object({
  statusBar: z
    .object({
      command: ForegroundHighlightConfigSchema.default(
        themeDefaults.statusBar.command,
      ),
      normal: ForegroundHighlightConfigSchema.default(
        themeDefaults.statusBar.normal,
      ),
      background: BackgroundHighlightConfigSchema.default(
        themeDefaults.statusBar.background,
      ),
    })
    .default(themeDefaults.statusBar),

  tree: z
    .object({
      leaf: ForegroundHighlightConfigSchema.default(themeDefaults.tree.leaf),
      branch: ForegroundHighlightConfigSchema.default(
        themeDefaults.tree.branch,
      ),
      folded: ForegroundHighlightConfigSchema.default(
        themeDefaults.tree.folded,
      ),
      cursorLine: BackgroundHighlightConfigSchema.default(
        themeDefaults.tree.cursorLine,
      ),
      indentGuide: OptionalForegroundHighlightConfigSchema.default(
        themeDefaults.tree.indentGuide,
      ),
    })
    .default(themeDefaults.tree),

  feedbackBar: z
    .object({
      message: ForegroundBackgroundHighlightConfigSchema.default(
        themeDefaults.feedbackBar.message,
      ),
      success: ForegroundBackgroundHighlightConfigSchema.default(
        themeDefaults.feedbackBar.success,
      ),
      error: ForegroundBackgroundHighlightConfigSchema.default(
        themeDefaults.feedbackBar.error,
      ),
    })
    .default(themeDefaults.feedbackBar),
}) satisfies z.ZodType<Theme>;

export const defaultTheme: Theme = ThemeSchema.parse({});
