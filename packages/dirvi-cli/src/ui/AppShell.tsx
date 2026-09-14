import { loadPosixAppApi } from '../infrastructure/load-posix-app-api.js';
import { LoadingApp } from './LoadingApp.js';
import { useMemo } from 'react';

export type ShellAppProps = {
  directory?: string;
  stdout?: (message: string) => void;
  clipboard?: (value: string) => void;
  onError?: (error: Error) => void;
};

// App Shell is for choosing the active app, then loading the api,
// and showing the app.
export function AppShell({
   directory,
   stdout,
   clipboard,
   onError
}: ShellAppProps) {
  // Api owns directory watcher and subscriptions
  const posixAppApi = useMemo(() => loadPosixAppApi(directory), [directory]);

  return (
    <LoadingApp
      appApi={posixAppApi}
      {...(stdout === undefined ? {} : { stdout })}
      {...(clipboard === undefined ? {} : { clipboard })}
      {...(onError === undefined ? {} : { onError })}
    />
  );
}
