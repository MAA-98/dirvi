import { z } from 'zod';

export const ConfigSchema = z.object({
  statusBarColor: z.string().default('gray'),
});

export type Config = z.infer<typeof ConfigSchema>;

export const defaultConfig: Config = ConfigSchema.parse({});
