import { z } from 'zod';
import { foregroundColorNames } from 'chalk';

const foregroundColorNameSet = new Set<string>(foregroundColorNames);
const rgbComponent = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';

export const ChalkColorSchema = z
  .string()
  .refine(
    (value) =>
      foregroundColorNameSet.has(value) ||
      /^#[\da-f]{6}$/i.test(value) ||
      new RegExp(
        `^rgb\\(\\s*${rgbComponent}\\s*,\\s*${rgbComponent}\\s*,\\s*${rgbComponent}\\s*\\)$`,
        'i',
      ).test(value) ||
      /^(?:ansi256)\(\s*(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\s*\)$/i.test(value),
    {
      message:
        'Expected a Chalk color name, #RRGGBB, rgb(r, g, b), or ansi256(n)',
    },
  );

export const ConfigSchema = z.object({
  statusBarBgColor: ChalkColorSchema.default('rgb(234, 234, 236)'),
});

export type Config = z.infer<typeof ConfigSchema>;

export const defaultConfig: Config = ConfigSchema.parse({});
