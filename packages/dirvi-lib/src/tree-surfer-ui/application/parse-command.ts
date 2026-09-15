import { SerializableKey, TreeNode } from '../../tree-surfer/index.js';
import { Effect } from '../domain/index.js';

const DEFAULT_VIEW_NAME = 'default';

export function parseCommand<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(commandLine: string): Effect<Id, BufferNode> | undefined {
  const command = commandLine.trim();

  switch (command) {
    case ':q':
      return {
        effectType: 'quit',
        exitMessage: '',
      };

    case ':evlp':
      return {
        effectType: 'emitVisibleLeavesPaths',
      };
  }

  /*
   * Vim-style view commands:
   *
   *   :mkview!
   *   :mkview! project
   *   :loadview
   *   :loadview project
   *
   * The name may contain spaces, so capture the remainder of the command
   * instead of splitting on whitespace.
   *
   * TODO Later: mkview that checks if same named view already saved
   */
  const viewCommand = command.match(/^:(mkview!|loadview)(?:\s+(.+?))?$/);

  if (viewCommand === null) {
    return undefined;
  }

  const commandName = viewCommand[1];
  const suppliedName = viewCommand[2]?.trim();
  const name = suppliedName || DEFAULT_VIEW_NAME;

  switch (commandName) {
    case 'mkview!':
      return {
        effectType: 'saveView',
        name,
        overwrite: true,
      };

    case 'loadview':
      return {
        effectType: 'loadView',
        name,
      };
  }
}
