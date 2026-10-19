import type { SerializableKey } from '../../trees/index.js';
import type { Effect } from '../domain/index.js';

const DEFAULT_VIEW_NAME = 'default';
const DEFAULT_FOLD_TREE_NAME = 'default';

function parseAppCommand<Id extends SerializableKey, Value>(
  commandArgs: readonly string[],
): Effect<Id, Value> {
  const [firstArgument, ...remainingArguments] = commandArgs;
  
  switch (firstArgument) {
    case 'list':
      return commandArgs.length === 1
        ? {
            effectType: 'listApps',
          }
        : {
            effectType: 'unrecognizedCommand',
            commandLine: `app ${commandArgs.join(' ')}`,
          };

    case 'open':
    case 'switch': {
      const [appId, input] = remainingArguments;

      if (appId === undefined || remainingArguments.length > 2) {
        return {
          effectType: 'unrecognizedCommand',
          commandLine: `app ${commandArgs.join(' ')}`,
        };
      }

      return {
        effectType: 'switchApp',
        appId,
        input,
      };
    }

    default: {
      if (firstArgument === undefined || remainingArguments.length > 1) {
        return {
          effectType: 'unrecognizedCommand',
          commandLine: `app ${commandArgs.join(' ')}`,
        };
      }
      
      const input = remainingArguments[0];

      return {
        effectType: 'switchApp',
        appId: firstArgument,
        input,
      };
    }
  }
}

function parseFoldCommand<Id extends SerializableKey, Value>(
  commandArgs: readonly string[],
): Effect<Id, Value> {
  const [subcommand, name] = commandArgs;

  switch (subcommand) {
    case 'list':
      return commandArgs.length === 1
        ? {
            effectType: 'listFolds',
          }
        : {
            effectType: 'unrecognizedCommand',
            commandLine: `fold ${commandArgs.join(' ')}`,
          };

    case 'create':
      return name === undefined || commandArgs.length !== 2
        ? {
            effectType: 'unrecognizedCommand',
            commandLine: `fold ${commandArgs.join(' ')}`,
          }
        : {
            effectType: 'dispatchEffectAction',
            action: {
              effectActionType: 'createFoldTree',
              name,
            },
          };

    case 'delete':
      return name === undefined || commandArgs.length !== 2
        ? {
            effectType: 'unrecognizedCommand',
            commandLine: `fold ${commandArgs.join(' ')}`,
          }
        : {
            effectType: 'dispatchEffectAction',
            action: {
              effectActionType: 'deleteFoldTree',
              name,
            },
          };

    case 'enable':
    case 'close':
      return commandArgs.length > 2
        ? {
            effectType: 'unrecognizedCommand',
            commandLine: `fold ${commandArgs.join(' ')}`,
          }
        : {
            effectType: 'dispatchEffectAction',
            action: {
              effectActionType: 'fold',
              foldTree: {
                foldTreeReferenceType: 'name',
                name: name ?? DEFAULT_FOLD_TREE_NAME,
              },
            },
          };

    case 'disable':
    case 'open':
      return commandArgs.length > 2
        ? {
            effectType: 'unrecognizedCommand',
            commandLine: `fold ${commandArgs.join(' ')}`,
          }
        : {
            effectType: 'dispatchEffectAction',
            action: {
              effectActionType: 'unfold',
              foldTree: {
                foldTreeReferenceType: 'name',
                name: name ?? DEFAULT_FOLD_TREE_NAME,
              },
            },
          };

    case 'toggle':
      return commandArgs.length > 2
        ? {
            effectType: 'unrecognizedCommand',
            commandLine: `fold ${commandArgs.join(' ')}`,
          }
        : {
            effectType: 'dispatchEffectAction',
            action: {
              effectActionType: 'toggleFold',
              foldTree: {
                foldTreeReferenceType: 'name',
                name: name ?? DEFAULT_FOLD_TREE_NAME,
              },
            },
          };

    default:
      return {
        effectType: 'unrecognizedCommand',
        commandLine: `fold ${commandArgs.join(' ')}`,
      };
  }
}

/**
 * Parses a Vim-style Ex command line into an application effect.
 *
 * Leading and trailing whitespace is removed, and all consecutive leading `:`
 * characters are removed before parsing. The remaining text is split on one or
 * more whitespace characters:
 *
 * - The first token is treated as the command name.
 * - All remaining tokens are passed to the command-specific parser as
 *   `commandArgs`.
 *
 * Parsing is token-based and does not support quoted or escaped arguments.
 * Consequently, whitespace within an argument cannot currently be preserved.
 * Command-specific parsers are responsible for validating their arguments.
 *
 * An empty command line produces `undefined`. An unknown command produces an
 * `unrecognizedCommand` effect containing the original `commandLine`.
 *
 * Command parsing is independent of the concrete tree-node value type, but the
 * generic parameters allow its result to compose with the application's
 * `Effect<Id, Value>` pipeline.
 *
 * @typeParam Id - The sibling-unique tree-node ID type.
 * @typeParam Value - Application-owned data stored in each tree node.
 * @param commandLine - The raw Ex command line, optionally prefixed with one
 * or more `:` characters.
 * @returns The parsed application effect, or `undefined` for an empty command.
 */
export function parseExCommand<Id extends SerializableKey, Value>(
  commandLine: string,
): Effect<Id, Value> | undefined {
  const command = commandLine.trim().replace(/^:+/, '');

  if (command === '') {
    return undefined;
  }

  const [commandName, ...commandArgs] = command.split(/\s+/);

  switch (commandName) {
    case 'q':
      return {
        effectType: 'quit',
        exitMessage: '',
      };
      
    case 'app':
      return parseAppCommand<Id, Value>(commandArgs);

    case 'fold':
      return parseFoldCommand<Id, Value>(commandArgs);

    case 'evlp':
      return {
        effectType: 'emitVisibleLeavesPaths',
      };

    case 'mkview!':
      return {
        effectType: 'saveView',
        name: commandArgs[0] || DEFAULT_VIEW_NAME,
        overwrite: true,
      };

    case 'loadview':
      return {
        effectType: 'loadView',
        name: commandArgs[0] || DEFAULT_VIEW_NAME,
      };

    default:
      return {
        effectType: 'unrecognizedCommand',
        commandLine,
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
}
