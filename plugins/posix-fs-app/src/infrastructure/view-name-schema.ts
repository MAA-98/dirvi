import { z } from 'zod';

const windowsReservedNames = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

/**
 * View names are also used as filenames.
 *
 * We intentionally keep the accepted format human-readable instead of
 * encoding names into opaque filenames. The restrictions are mostly for
 * portability between POSIX and Windows filesystems:
 *
 * - no path separators or control characters;
 * - no Windows-invalid filename characters;
 * - no leading/trailing whitespace;
 * - no trailing periods or spaces;
 * - no "." or "..";
 * - no Windows device names such as "CON" or "NUL";
 * - limited length.
 */
export const viewNameSchema = z
  .string()
  .min(1, 'View name cannot be empty.')
  .max(100, 'View name cannot be longer than 100 characters.')
  .refine((name) => name === name.trim(), {
    message: 'View name cannot start or end with whitespace.',
  })
  .refine((name) => name !== '.' && name !== '..', {
    message: 'View name cannot be "." or "..".',
  })
  .refine((name) => !/[\/\\]/u.test(name), {
    message: 'View name cannot contain path separators.',
  })
  .refine((name) => !/[\u0000-\u001f\u007f]/u.test(name), {
    message: 'View name cannot contain control characters.',
  })
  .refine((name) => !/[<>:"|?*]/u.test(name), {
    message: 'View name contains a character that is not portable.',
  })
  .refine((name) => !/[. ]$/u.test(name), {
    message: 'View name cannot end with a period or space.',
  })
  .refine(
    (name) => {
      const basename = name.split('.')[0]!.toUpperCase();
      return !windowsReservedNames.has(basename);
    },
    {
      message: 'View name is reserved by Windows.',
    },
  );
