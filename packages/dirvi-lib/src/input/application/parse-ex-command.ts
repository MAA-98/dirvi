import type { Effect } from '../domain/index.js';

const DEFAULT_FOLD_TREE_NAME = 'default';

/**
 * Parses an Ex command into an application effect.
 *
 * Any combination of whitespace, then multiple `:`, then whitespace is optional
 * and ignored.
 *
 * Registered commands take precedence over built-ins and receive their
 * arguments as a raw string, with the beginning space ignored.
 *
 * @param commandLine - The raw command line with the beginning filler, command
 * and options.
 * @param registeredCommands - Names of registered commands that override
 * built-ins.
 * @returns An effect, or `undefined` for an empty command.
 */
export function parseExCommand<Id, Value>(
  commandLine: string,
  registeredCommands: ReadonlySet<string>,
): Effect<Id, Value> | undefined {
  const command = commandLine.trimStart().replace(/^:+/, '').trimStart();

  if (command === '') {
    return undefined;
  }

  // Split into:
  // match[0]; // the full matched string
  // match[1]; // command name
  // match[2]; // arguments, or undefined if there was no separator
  const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(command);
  const commandName = match?.[1];
  // Empty args changed to undefined
  const rawArgs = match?.[2] === '' ? undefined : match?.[2];

  // Empty command
  if (commandName === undefined) {
    return undefined;
  }

  if (registeredCommands.has(commandName)) {
    return {
      effectType: 'userExCommand',
      command: commandName,
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

    default:
      return {
        effectType: 'emitError',
        message: `Unrecognized command: "${commandLine}"`,
      };
  }
}

function parseAppCommand<Id, Value>(
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

function parseFoldCommand<Id, Value>(
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
