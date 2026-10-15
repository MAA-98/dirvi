import { AppApiApplicator } from 'dirvi-apis';

import { AppSetup } from './AppSetup.js';
import type { Config } from '../domain/config.js';
import type { AppScreenRenderer } from './app-screen.js';

/**
 * Dependencies and output callbacks required by {@link Shell}.
 *
 * The API loader functions are injected so the shell does not depend directly
 * on a platform-specific infrastructure implementation.
 */
export type ShellAppProps = {
  /**
   * Host-specific React implementation of the active application screen.
   */
  readonly screenRenderer: AppScreenRenderer;

  /**
   * Resolved startup configuration.
   *
   * The composition root evaluates init.mjs before rendering the UI, so
   * configuration is already validated and does not change while this shell
   * is running.
   */
  readonly config: Config;

  /**
   * Higher order function that will get a result given a function that has
   * app api as input.
   */
  readonly appApiApplicator: AppApiApplicator;

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
  screenRenderer,
  config,
  appApiApplicator,
  stdout,
  clipboard,
  onError,
}: ShellAppProps) {
  // Result type is specified here to be AppSetup
  return appApiApplicator((appApi) => (
    <AppSetup
      screenRenderer={screenRenderer}
      loadedConfig={config}
      appApi={appApi}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
      {...(onError === undefined ? {} : { onError })}
    />
  ));
}
