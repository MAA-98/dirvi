import { SerializableKey } from 'dirvi-apis';
import type { Effect } from '../domain/index.js';

// const DEFAULT_VIEW_NAME = 'default';
const DEFAULT_FOLD_TREE_NAME = 'default';

function parseAppCommand<Id extends SerializableKey, Value>(
  commandArgs: readonly string[],
): Effect<Id, Value> {
  const [firstArgument, ...remainingArguments] = commandArgs;
  const badArgs = {
    effectType: 'emitError',
    message: `Unrecognized command arguments: app ${commandArgs.join(' ')}`,
  } satisfies Effect<Id, Value>;
  
  switch (firstArgument) {
    case 'list':
      return commandArgs.length === 1
        ? {
            effectType: 'listApps',
          }
        : badArgs;

    case 'open':
    case 'switch': {
      const [appId, input] = remainingArguments;

      if (appId === undefined || remainingArguments.length > 2) {
        return badArgs;
      }

      return {
        effectType: 'switchApp',
        appId,
        input,
      };
    }

    default: {
      if (firstArgument === undefined || remainingArguments.length > 1) {
        return badArgs;
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
  const badArgs = {
    effectType: 'emitError',
    message: `Unrecognized command arguments: fold ${commandArgs.join(' ')}`,
  } satisfies Effect<Id, Value>;

  switch (subcommand) {
    case 'list':
      return commandArgs.length === 1
        ? {
            effectType: 'listFolds',
          }
        : badArgs;

    case 'create':
      return name === undefined || commandArgs.length !== 2
        ? badArgs
        : {
            effectType: 'dispatchEffectAction',
            action: {
              effectActionType: 'createFoldTree',
              name,
            },
          };

    case 'delete':
      return name === undefined || commandArgs.length !== 2
        ? badArgs
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
        ? badArgs
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
        ? badArgs
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
        ? badArgs
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
      return badArgs;
  }
}

/**
 * Parses a Vim-style Ex command into an application effect.
 *
 * Leading `:` characters are optional. Arguments are split on whitespace;
 * quoting and escaping are not supported.
 *
 * Registered commands take precedence over built-ins and receive their
 * arguments without validation. This function does not execute them.
 *
 * @param commandLine - The raw command line.
 * @param registeredCommands - User-command names that override built-ins.
 * @returns An effect, or `undefined` for an empty command.
 */
export function parseExCommand<Id extends SerializableKey, Value>(
  commandLine: string,
  registeredCommands: ReadonlySet<string>,
): Effect<Id, Value> | undefined {
  const command = commandLine.trimStart().replace(/^:+/, '').trimStart();

  if (command === '') {
    return undefined;
  }

  const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(command);

  if (match === null) {
    return undefined;
  }

  const commandName = match[1]!;
  const rawArgs = match[2];

  if (commandName !== undefined && registeredCommands.has(commandName)) {
    return {
      effectType: 'userExCommand',
      name: commandName,
      rawArgs,
    };
  }

  // Built-ins have whitespace-based argument parsing.
  const commandArgs =
    rawArgs === undefined || rawArgs.trim() === ''
      ? []
      : rawArgs.trim().split(/\s+/);
  
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

    // case 'mkview!':
    //   return {
    //     effectType: 'saveView',
    //     name: commandArgs[0] || DEFAULT_VIEW_NAME,
    //     overwrite: true,
    //   };
    //
    // case 'loadview':
    //   return {
    //     effectType: 'loadView',
    //     name: commandArgs[0] || DEFAULT_VIEW_NAME,
    //   };

    default:
      return {
        effectType: 'emitError',
        message: `Unrecognized command: "${commandLine}"`,
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
