import { z } from 'zod';
import { foregroundColorNames } from 'chalk';

// =============================================================================
// Terminal colors
// =============================================================================

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, {
  message: 'Expected a #rrggbb color',
});

const Ansi256ColorSchema = z.number().int().min(0).max(255);

// Background colors are the same set, just altered names. You can check
// `backgroundColorNames`
const colorNameSet = new Set<string>(foregroundColorNames);

const BasicColorSchema = z.string().refine((value) => colorNameSet.has(value), {
  message: 'Expected a Chalk basic color name',
});

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
  );

export type ColorConfig = z.infer<typeof ColorConfigSchema>;

// =============================================================================
// Highlights
// =============================================================================
// Note: these schemas are meant to be non-strict
export const ForegroundHighlightConfigSchema = z.object({
  fg: ColorConfigSchema,
});

export const OptionalForegroundHighlightConfigSchema = z.object({
  fg: ColorConfigSchema.optional(),
});

export const BackgroundHighlightConfigSchema = z.object({
  bg: ColorConfigSchema,
});

export const ForegroundBackgroundHighlightConfigSchema = z.object({
  fg: ColorConfigSchema,
  bg: ColorConfigSchema,
});

export type ForegroundHighlightConfig = z.infer<
  typeof ForegroundHighlightConfigSchema
>;

export type OptionalForegroundHighlightConfig = z.infer<
  typeof OptionalForegroundHighlightConfigSchema
>;

export type BackgroundHighlightConfig = z.infer<
  typeof BackgroundHighlightConfigSchema
>;

export type ForegroundBackgroundHighlightConfig = z.infer<
  typeof ForegroundBackgroundHighlightConfigSchema
>;

// =============================================================================
// Theme defaults
// =============================================================================

const black: ColorConfig = {
  hex: '#28282a',
  ansi256: 235,
  basic: 'black',
};

const lightGray: ColorConfig = {
  hex: '#eaeaec',
  ansi256: 254,
  basic: 'gray',
};

const leaf: ColorConfig = {
  hex: '#e5e5e5',
  ansi256: 254,
  basic: 'white',
};

const branch: ColorConfig = {
  hex: '#2472c8',
  ansi256: 26,
  basic: 'blue',
};

const folded: ColorConfig = {
  hex: '#808080',
  ansi256: 245,
  basic: 'gray',
};

const indentGuide: ColorConfig = {
  hex: '#808080',
  ansi256: 245,
  basic: 'gray',
};

const cursorLine: ColorConfig = {
  hex: '#3a3a3c',
  ansi256: 237,
  basic: 'gray',
};

const success: ColorConfig = {
  hex: '#238c4b',
  ansi256: 28,
  basic: 'green',
};

const error: ColorConfig = {
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
// Theme schema
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
});

export type Theme = z.infer<typeof ThemeSchema>;

export const defaultTheme: Theme = ThemeSchema.parse({});
