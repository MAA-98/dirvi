import { z } from 'zod';
import { defaultTheme, ThemeSchema } from './theme.js';

// =============================================================================
// Configuration Schema
// =============================================================================
export const ConfigSchema = z.object({
  indentSize: z.number().int().min(0).default(2),
  theme: ThemeSchema.default(defaultTheme),
});

export type Config = z.infer<typeof ConfigSchema>;

export const defaultConfig: Config = ConfigSchema.parse({});
