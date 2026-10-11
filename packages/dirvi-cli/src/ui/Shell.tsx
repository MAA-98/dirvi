import type { OpenApp } from 'dirvi-apis';

import { AppSetup } from './AppSetup.js';
import type { Config } from '../domain/config.js';

/**
 * Dependencies and output callbacks required by {@link Shell}.
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
  readonly config: Config;

  /**
   * The application currently mounted in the shell.
   *
   * OpenApp hides the concrete AppApi generic parameters from the persistent
   * shell while allowing AppSetup to receive a coherent concrete AppApi.
   */
  readonly activeApp: OpenApp;

  // /**
  //  * Creates the POSIX application API for the selected directory.
  //  *
  //  * The returned API owns directory loading, filesystem watching, and view
  //  * persistence.
  //  */
  // loadPosixAppApi: (
  //   directory?: string,
  // ) => AppApi<PosixName, PosixEntry, UnixAbsolutePath>;
  //
  // /**
  //  * Optional directory to browse.
  //  *
  //  * When omitted, the platform-specific loader determines the default
  //  * directory.
  //  */
  // directory?: string;

  /** Writes non-interactive application output. */
  readonly stdout?: (message: string) => void;

  /** Copies a value to the platform clipboard. */
  readonly clipboard?: (value: string) => void;

  /** Receives errors that should be reported by the composition root. */
  readonly onError?: (error: Error) => void;
};

/**
 * Hosts the currently active application inside the persistent terminal shell.
 *
 * Shell deliberately does not depend on a concrete AppApi type. OpenApp keeps
 * each application's Id, Value, and ViewKey types coherent while hiding those
 * details from shell-level concerns such as startup, app selection, terminal
 * integration, clipboard access, and error reporting.
 *
 * AppSetup receives the concrete AppApi and mounts the app-specific tree UI.
 */
export function Shell({
  config,
  activeApp,
  stdout,
  clipboard,
  onError,
}: ShellAppProps) {
  return activeApp.withAppApi({
    render: (appApi) => (
      <AppSetup
        loadedConfig={config}
        appApi={appApi}
        {...(stdout === undefined ? {} : { stdout })}
        {...(clipboard === undefined ? {} : { clipboard })}
        {...(onError === undefined ? {} : { onError })}
      />
    ),
  });
}
