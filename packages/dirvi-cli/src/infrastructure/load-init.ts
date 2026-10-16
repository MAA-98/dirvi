import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import type { Init, InitApi, PackageLoader } from '@mak-98/dirvi-app';
import { createInitRuntime } from '@mak-98/dirvi-app';

/**
 * Evaluates the user's init.mjs startup script and returns its resolved
 * configuration.
 *
 * While init.mjs is evaluated, this loader provides the global `dirvi` API.
 * The script configures dirvi by calling that API:
 *
 * ```js
 * dirvi.options.set({
 *   indentSize: 4,
 * });
 * ```
 *
 * The global API is restored after evaluation, whether evaluation succeeds or
 * fails. A missing init.mjs is valid and resolves to the default
 * configuration.
 *
 * init.mjs is trusted local code. It executes with the same Node.js
 * permissions as the dirvi process and may import other ESM modules.
 *
 * @throws {Error} When init.mjs cannot be read, imported, executed, or when
 * configuration registered by the script is invalid.
 */
export async function loadInit({
  packageLoader,
  initPath,
}: {
  packageLoader: Readonly<PackageLoader>;
  initPath: string;
}): Promise<Init> {
  // A missing init.mjs means no script registrations. Other access failures are
  // startup errors and must not be treated as a missing configuration file.
  try {
    await access(initPath);
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return createInitRuntime(packageLoader).finish();
    }
    throw error;
  }

  const runtime = createInitRuntime(packageLoader);
  // Preserve an existing property descriptor so this loader does not leak its
  // startup API into the process after init.mjs evaluation completes.
  const previousDirvi = Object.getOwnPropertyDescriptor(globalThis, 'dirvi');

  Object.defineProperty(globalThis, 'dirvi', {
    configurable: true,
    value: runtime.api,
    // init.mjs may call the global `dirvi` API but cannot replace it.
    writable: false,
  });

  try {
    // Convert the filesystem path into a file URL before dynamic ESM import.
    // init.mjs may use imports and top-level await normally.
    await import(pathToFileURL(initPath).href);

    // Seal startup registration only after the full init module graph has
    // finished evaluating.
    return runtime.finish();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Unable to evaluate configuration at ${initPath}: ${message}`,
    );
  } finally {
    restoreGlobalDirvi(previousDirvi);
  }
}

/**
 * Restores the global `dirvi` property to exactly the state it had before
 * init.mjs was evaluated.
 *
 * Restoring the full property descriptor preserves a pre-existing getter,
 * setter, writability, configurability, or value. If no property existed,
 * remove the temporary injected API entirely.
 */
function restoreGlobalDirvi(
  previousDirvi: PropertyDescriptor | undefined,
): void {
  if (previousDirvi === undefined) {
    delete (globalThis as { dirvi?: InitApi }).dirvi;
    return;
  }

  Object.defineProperty(globalThis, 'dirvi', previousDirvi);
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
