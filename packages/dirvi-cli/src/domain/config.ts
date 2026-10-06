import { z } from 'zod';
import { defaultTheme, ThemeSchema } from './theme.js';

// =============================================================================
// Configuration Schema
// =============================================================================
export const ConfigSchema = z.object({
  indentSize: z.number().int().min(0).default(2),
  // When omitted, ViewRowComponent uses `indentSize` spaces.
  // An empty string is valid and removes the first indentation prefix.
  firstIndent: z.string().optional(),
  theme: ThemeSchema.default(defaultTheme),
});

export type Config = z.infer<typeof ConfigSchema>;

export const defaultConfig: Config = ConfigSchema.parse({});
