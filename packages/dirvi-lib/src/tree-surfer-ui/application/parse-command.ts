import type { SerializableKey } from '../../tree-surfer/index.js';
import type { Effect } from '../domain/index.js';

const DEFAULT_VIEW_NAME = 'default';

/**
 * Parses a command-line command into an application effect.
 *
 * Command parsing is independent of the concrete tree-node value type, but the
 * generic parameters allow its result to compose with the application's
 * Effect<Id, Value> pipeline.
 *
 * @typeParam Id - The sibling-unique tree-node ID type.
 * @typeParam Value - Application-owned data stored in each tree node.
 */
export function parseCommand<Id extends SerializableKey, Value>(
  commandLine: string,
): Effect<Id, Value> | undefined {
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
   * TODO Later: mkview that checks if a same-named view already exists.
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

    default:
      return undefined;
  }
}
