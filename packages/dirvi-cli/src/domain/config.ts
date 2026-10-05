import { z } from 'zod';
import { backgroundColorNames, foregroundColorNames } from 'chalk';

const RgbComponentSchema = z.number().int().min(0).max(255);
const RgbColorSchema = z.tuple([
  RgbComponentSchema,
  RgbComponentSchema,
  RgbComponentSchema,
]);
const Ansi256ColorSchema = z.number().int().min(0).max(255);
const foregroundColorNameSet = new Set<string>(foregroundColorNames);
const BasicFgColorSchema = z
  .string()
  .refine((value) => foregroundColorNameSet.has(value), {
    message: 'Expected a Chalk basic color name',
  });
const shortBgColorNames = backgroundColorNames.map(
  (value) => `${value.slice(2, 3).toLowerCase()}${value.slice(3)}`,
);
const backgroundColorNameSet = new Set<string>(shortBgColorNames);
const BasicBgColorSchema = z
  .string()
  .refine((value) => backgroundColorNameSet.has(value), {
    message: 'Expected a Chalk basic color name',
  });

export const ColorConfigSchema = z
  .object({
    trueColor: RgbColorSchema.optional(),
    ansi256: Ansi256ColorSchema.optional(),
    basic: BasicBgColorSchema.optional(),
  })
  .refine(
    (value) =>
      value.trueColor !== undefined ||
      value.ansi256 !== undefined ||
      value.basic !== undefined,
    {
      message: 'Expected at least one status bar background color profile',
    },
  );

export const ConfigSchema = z.object({
  statusBarBgColor: ColorConfigSchema.default({
    trueColor: [234, 234, 236],
    ansi256: 254,
    basic: 'gray',
  }),
});

export type ColorConfig = z.infer<typeof ColorConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export const defaultConfig: Config = ConfigSchema.parse({});
