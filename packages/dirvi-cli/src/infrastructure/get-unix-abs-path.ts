import { resolve } from 'node:path';

import type { UnixAbsolutePath } from 'dirvi-lib';
import { UnixAbsolutePathSchema } from 'dirvi-lib';

export function getUnixAbsPath(directory: string): UnixAbsolutePath {
  const absolutePath = resolve(directory);
  const result = UnixAbsolutePathSchema.safeParse(absolutePath);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => issue.message)
      .join('; ');

    throw new Error(
      `Bad path for directory "${directory}" ` +
        `(resolved to "${absolutePath}"): ${details}`,
    );
  }

  return result.data;
}
