import { useMemo } from 'react';

import { AppSetup } from './AppSetup.js';
import type { Config } from '../domain/config.js';
import type { AppApi } from 'dirvi-lib';
import type { PosixEntry, PosixName } from '../domain/posix-tree-node.js';
import type { UnixAbsolutePath } from '../domain/unix-path.js';

/**
 * Dependencies and output callbacks required by {@link AppShell}.
 *
 * The API loader functions are injected so the shell does not depend directly
 * on a platform-specific infrastructure implementation.
 */
export type ShellAppProps = {
  /**
   * Resolved startup configuration.
   *
   * The composition root evaluates init.mjs before rendering the UI, so
   * configuration is already validated and does not change while this shell
   * is running.
   */
  config: Config;

  /**
   * Creates the POSIX application API for the selected directory.
   *
   * The returned API owns directory loading, filesystem watching, and view
   * persistence.
   */
  loadPosixAppApi: (
    directory?: string,
  ) => AppApi<PosixName, PosixEntry, UnixAbsolutePath>;

  /**
   * Optional directory to browse.
   *
   * When omitted, the platform-specific loader determines the default
   * directory.
   */
  directory?: string;

  /** Writes non-interactive application output. */
  stdout?: (message: string) => void;

  /** Copies a value to the platform clipboard. */
  clipboard?: (value: string) => void;

  /** Receives errors that should be reported by the composition root. */
  onError?: (error: Error) => void;
};

/**
 * Composes the application API and renders the application setup.
 *
 * `AppShell` is kept independent of the concrete POSIX infrastructure by
 * receiving the POSIX API loader through its props. Startup configuration is
 * evaluated by the composition root before rendering and is passed in as an
 * already validated value.
 *
 * The shell memoizes the POSIX API instance so its filesystem watchers and
 * subscriptions are not recreated during ordinary React renders.
 *
 * @param props - Startup configuration, POSIX API loader, optional directory,
 * and application callbacks.
 */
export function AppShell({
  config,
  loadPosixAppApi,
  directory,
  stdout,
  clipboard,
  onError,
}: ShellAppProps) {
  // Owns stable API instances.
  // The APIs own their file watchers and subscriptions.
  const posixAppApi = useMemo(
    () => loadPosixAppApi(directory),
    [directory, loadPosixAppApi],
  );

  return (
    <AppSetup
      loadedConfig={config}
      appApi={posixAppApi}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
      {...(onError === undefined ? {} : { onError })}
    />
  );
}
