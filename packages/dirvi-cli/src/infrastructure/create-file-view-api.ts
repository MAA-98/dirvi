import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';

import type { ViewApi, ViewSummary } from '../domain/view-api.js';
import { viewNameSchema } from './view-name-schema.js';
import { SerializableKey, State, TreeNode } from 'dirvi-lib';

export type StateCodec<RuntimeState, StoredState> = {
  schema: z.ZodType<StoredState>;
  encode: (state: RuntimeState) => StoredState;
  decode: (state: StoredState) => RuntimeState;
};

type StoredView<StoredState> = {
  version: 1;
  name: string;
  updatedAt: string;
  state: StoredState;
};

function createStoredViewSchema<StoredState>(
  stateSchema: z.ZodType<StoredState>,
): z.ZodType<StoredView<StoredState>> {
  return z.object({
    version: z.literal(1),
    name: viewNameSchema,
    updatedAt: z.iso.datetime(),
    state: stateSchema,
  }) as z.ZodType<StoredView<StoredState>>;
}

function isNodeErrorWithCode(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}

/**
 * Creates a file-backed implementation of ViewApi.
 *
 * Each key receives its own directory, and each named view is stored as one
 * JSON file inside that directory:
 *
 *   <directory>/<encoded-key>/<view-name>.json
 *
 * The view name is validated before being used as a filename. The key is
 * converted into one safe path segment by the caller-provided `encodeKey`
 * function.
 *
 * For example:
 *
 *   .../posix/views/<directory-hash>/project.json
 */
export function createFileViewApi<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
  StoredState,
  Key,
>({
  directory,
  encodeKey,
  stateCodec,
}: {
  directory: string;
  encodeKey: (key: Key) => string;
  stateCodec: StateCodec<State<Id, BufferNode>, StoredState>;
}): ViewApi<State<Id, BufferNode>, Key> {
  const storedViewSchema = createStoredViewSchema(stateCodec.schema);

  /**
   * Returns the directory containing all views for one app-specific key.
   *
   * `encodeKey` must return one safe path segment. In particular, it must not
   * return "/", "\\", ".", "..", or a value containing path separators.
   */
  function keyDirectory(key: Key): string {
    const encodedKey = encodeKey(key);

    if (
      encodedKey.length === 0 ||
      encodedKey === '.' ||
      encodedKey === '..' ||
      encodedKey.includes('/') ||
      encodedKey.includes('\\')
    ) {
      throw new Error('encodeKey must return one safe path segment.');
    }

    return join(directory, encodedKey);
  }

  /**
   * Returns the file containing one named view for a key.
   *
   * View names are validated by `viewNameSchema` before they are used as
   * filenames. No encoding is necessary because invalid path characters have
   * already been rejected.
   */
  function viewFile(key: Key, name: string): string {
    const validName = viewNameSchema.parse(name);

    return join(keyDirectory(key), `${validName}.json`);
  }
  
  async function save(
    key: Key,
    name: string,
    state: State<Id, BufferNode>,
  ): Promise<void> {
    const dir = keyDirectory(key);

    await mkdir(dir, {
      recursive: true,
      mode: 0o700,
    });

    const file = viewFile(key, name);
    const storedState = stateCodec.encode(state);

    const value = storedViewSchema.parse({
      version: 1,
      name,
      updatedAt: new Date().toISOString(),
      state: storedState,
    });

    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;

    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });

    await rename(temporary, file);
  }
  
  async function load(
    key: Key,
    name: string,
  ): Promise<State<Id, BufferNode> | undefined> {
    try {
      const contents = await readFile(viewFile(key, name), 'utf8');
      const parsed: unknown = JSON.parse(contents);
      const value = storedViewSchema.parse(parsed);

      return stateCodec.decode(value.state);
    } catch (error: unknown) {
      if (isNodeErrorWithCode(error, 'ENOENT')) {
        return undefined;
      }

      throw error;
    }
  }

  async function list(key: Key): Promise<readonly ViewSummary[]> {
    const dir = keyDirectory(key);

    let files: string[];

    try {
      files = await readdir(dir);
    } catch (error: unknown) {
      // A key with no saved views does not have a directory yet.
      if (isNodeErrorWithCode(error, 'ENOENT')) {
        return [];
      }

      throw error;
    }

    const summaries: ViewSummary[] = [];

    for (const file of files) {
      /*
       * Ignore temporary files, unrelated files, and any future files that
       * might be stored alongside view files.
       */
      if (!file.endsWith('.json')) {
        continue;
      }

      /*
       * The name and timestamp are stored in the JSON envelope. Listing
       * therefore requires reading each view file. If this becomes expensive
       * later, metadata could be kept in a separate index.
       */
      const contents = await readFile(join(dir, file), 'utf8');
      const parsed: unknown = JSON.parse(contents);
      const value = storedViewSchema.parse(parsed);

      summaries.push({
        name: value.name,
        updatedAt: value.updatedAt,
      });
    }

    return summaries;
  }

  async function remove(key: Key, name: string): Promise<void> {
    try {
      // viewFile() validates the name before constructing the path.
      await unlink(viewFile(key, name));
    } catch (error: unknown) {
      // Removing a view that does not exist is intentionally idempotent.
      if (isNodeErrorWithCode(error, 'ENOENT')) {
        return;
      }

      throw error;
    }
  }

  return {
    save,
    load,
    list,
    remove,
  };
}
