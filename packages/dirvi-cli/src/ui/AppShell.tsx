import { EventMessage } from '../domain/event-message.js';
import { loadPosixAppApi } from '../infrastructure/load-posix-app-api.js';
import { LoadingApp } from './LoadingApp.js';
import { PosixName, PosixNode, SerializableKey, TreeNode } from 'dirvi-lib';
import { join } from 'node:path';
import { useMemo } from 'react';

export type ShellAppProps = {
  directory?: string;
  print?: (message: string) => void;
  onError?: (error: Error) => void;
};

// App Shell is for choosing the active app, then loading the api,
// and showing the app.
export function AppShell<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>({ directory, print, onError }: ShellAppProps) {
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
    <LoadingApp
      appApi={posixAppApi}
      {...(emitEventMsg === undefined ? {} : { print: emitEventMsg })}
      {...(onError === undefined ? {} : { onError })}
    />
  );
}
