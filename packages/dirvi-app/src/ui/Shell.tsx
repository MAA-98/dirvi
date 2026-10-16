import { useState } from 'react';

import type { DirviApi } from '../domain/dirvi-api.js';
import type { AppInput } from '../domain/app.js';
import type { AppScreenRenderer } from './app-screen-renderer.js';
import type { LoadingScreenRenderer } from './loading-screen-renderer.js';
import { AppSetup } from './AppSetup.js';

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
  readonly appScreenRenderer: AppScreenRenderer;
  readonly loadingScreenRenderer: LoadingScreenRenderer;

  readonly dirviApi: DirviApi;
  readonly initialAppInput: AppInput;

  /** Writes non-interactive application output. */
  readonly stdout?: (message: string) => void;

  /** Copies a value to the platform clipboard. */
  readonly clipboard?: (value: string) => void;
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
  appScreenRenderer,
  loadingScreenRenderer,
  dirviApi,
  initialAppInput,
  stdout,
  clipboard,
}: ShellAppProps) {
  const [appApiApplicator, setAppApiApplicator] = useState(() =>
    dirviApi.openApp(dirviApi.initialAppId, initialAppInput),
  );
  // Result type is specified here to be AppSetup
  return appApiApplicator((appApi) => (
    <AppSetup
      appScreenRenderer={appScreenRenderer}
      loadingScreenRenderer={loadingScreenRenderer}
      loadedConfig={dirviApi.config}
      appApi={appApi}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
    />
  ));
}
