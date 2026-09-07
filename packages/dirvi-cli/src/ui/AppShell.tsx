import { EventMessage } from '../domain/event-message.js';
import { loadPosixAppProps } from '../infrastructure/load-posix-app-props.js';
import { LoadingApp } from './LoadingApp.js';
import { PosixName, PosixNode, TreeNode } from 'dirvi-lib';

export type ShellAppProps<Name, BufferNode> = {
  print?: (message: string) => void;
  onError?: (error: Error) => void;
};

// App Shell is for choosing the active app, then loading the api,
// and showing the app.
export function AppShell<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>({ print, onError }: ShellAppProps<Name, BufferNode>) {
  const appProps = loadPosixAppProps();
  const emitEventMsg = print
    ? (message: EventMessage<PosixName, PosixNode>) => {
        print(`${JSON.stringify(message)}\n`);
      }
    : undefined;

  return (
    <LoadingApp appApi={appProps} print={emitEventMsg} onError={onError} />
  );
}
