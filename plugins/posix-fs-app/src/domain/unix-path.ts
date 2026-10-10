import { z } from 'zod';

// UNIX PATHS
export const UnixPathSchema = z
  .string()
  .min(1)
  .refine((value) => !value.includes('\0'), {
    message: 'Unix paths must not contain null bytes',
  });

export type UnixPath = z.output<typeof UnixPathSchema>;

export const UnixAbsolutePathSchema = UnixPathSchema.refine(
  (value) => value.startsWith('/'),
  {
    message: 'Path must be an absolute Unix path',
  },
);

export type UnixAbsolutePath = z.output<typeof UnixAbsolutePathSchema>;
