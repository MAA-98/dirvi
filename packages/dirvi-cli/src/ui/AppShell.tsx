import { EventMessage } from '../domain/event-message.js';
import { loadPosixAppApi } from '../infrastructure/load-posix-app-api.js';
import { LoadingApp } from './LoadingApp.js';
import { PosixName, PosixNode, TreeNode } from 'dirvi-lib';
import { join } from 'node:path';
import { useMemo } from 'react';

export type ShellAppProps<Name, BufferNode> = {
  directory?: string;
  print?: (message: string) => void;
  onError?: (error: Error) => void;
};

// App Shell is for choosing the active app, then loading the api,
// and showing the app.
export function AppShell<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>({ directory, print, onError }: ShellAppProps<Name, BufferNode>) {
  // Api owns directory watcher and subscriptions
  const posixAppApi = useMemo(() => loadPosixAppApi(directory), [directory]);

  const emitEventMsg = print
    ? (message: EventMessage<PosixName, PosixNode>) => {
        const externalMessage =
          message.type === 'displayed-leaves-paths'
            ? {
                ...message,
                paths: message.paths.map((path) => join(...path)),
              }
            : message;

        print(`${JSON.stringify(externalMessage)}\n`);
      }
    : undefined;

  return (
    <LoadingApp appApi={posixAppApi} print={emitEventMsg} onError={onError} />
  );
}
