import { useMemo } from 'react';

import { AppSetup } from './AppSetup.js';
import type { ConfigApi } from '../application/config-api.js';
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
   * Creates the configuration API.
   *
   * The returned API owns configuration loading, saving, file watching, and
   * change subscriptions.
   */
  loadConfigApi: () => ConfigApi;

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
 * Composes the application APIs and renders the loading application.
 *
 * `AppShell` is kept independent of the concrete infrastructure
 * implementations by receiving API loader functions through its props.
 * It memoizes the resulting API instances so their watchers and
 * subscriptions are not recreated during ordinary React renders.
 *
 * The APIs themselves own their file watchers and subscriptions. The shell
 * only owns the identity of the API instances and passes them to
 * `LoadingApp`.
 *
 * @param props - API loaders, optional directory option, and application
 * callbacks.
 */
export function AppShell({
  loadConfigApi,
  loadPosixAppApi,
  directory,
  stdout,
  clipboard,
  onError,
}: ShellAppProps) {
  // Owns stable API instances.
  // The APIs own their file watchers and subscriptions.
  const configApi = useMemo(() => loadConfigApi(), [loadConfigApi]);
  const posixAppApi = useMemo(
    () => loadPosixAppApi(directory),
    [directory, loadPosixAppApi],
  );

  return (
    <AppSetup
      configApi={configApi}
      appApi={posixAppApi}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
      {...(onError === undefined ? {} : { onError })}
    />
  );
}
