import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import type {
  Init,
  InitApi,
  InitRuntimeDependencies,
} from '../application/init-runtime.js';
import { createInitRuntime } from '../application/init-runtime.js';

/**
 * Evaluates the user's init.mjs startup script and returns its resolved
 * configuration.
 *
 * While init.mjs is evaluated, this loader temporarily exposes the
 * configuration runtime API as `globalThis.dirvi`. The script can configure
 * dirvi by calling that API:
 *
 * ```js
 * globalThis.dirvi.options.set({
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
  deps,
  initPath,
}: {
  deps: InitRuntimeDependencies;
  initPath: string;
}): Promise<Init> {
  if (!(await initFileExists(initPath))) {
    return createInitRuntime(deps).finish();
  }

  const runtime = createInitRuntime(deps);
  // Preserve an existing property descriptor so this loader does not leak its
  // startup API into the process after init.mjs evaluation completes.
  const previousDirvi = Object.getOwnPropertyDescriptor(globalThis, 'dirvi');
  // Use a non-writable property so configuration code can call the supported
  // API but cannot replace the host-provided `globalThis.dirvi` binding.
  Object.defineProperty(globalThis, 'dirvi', {
    configurable: true,
    value: runtime.api,
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
 * Determines whether the optional init.mjs entrypoint exists.
 *
 * Only a missing file is treated as "use defaults". Permission errors, an
 * unreadable parent directory, and other filesystem failures remain startup
 * errors rather than being silently interpreted as absent configuration.
 */
async function initFileExists(initPath: string): Promise<boolean> {
  try {
    await access(initPath);
    return true;
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

/**
 * Restores `globalThis.dirvi` to exactly the state it had before init.mjs was
 * evaluated.
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

/** Returns true only for the filesystem "entry does not exist" condition. */
function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
