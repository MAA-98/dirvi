import type { State, StateMethods } from '../../state-and-nav/index.js';
import type { Effect, EffectAction, Intent } from '../domain/index.js';

import { parseExCommand } from './parse-ex-command.js';
import { parseNormalCommand } from './parse-normal-command.js';

/**
 * Converts a user intent and the current tree state into an effect.
 *
 * By design, "effect = intent + state": whether an effect should be executed
 * depends on both the received intent and the current state.
 *
 * @typeParam Id - The sibling-unique tree-node ID type.
 * @typeParam Value - Application-owned data stored in each tree node.
 */
export type IntentToEffect<Id, Value> = (
  intent: Intent,
  state: State<Id, Value>,
) => Effect<Id, Value> | undefined;

export function createIntentToEffect<Id, Value>(
  userNormalCommands: ReadonlySet<string>,
  userExCommands: ReadonlySet<string>,
  stateApi: StateMethods<Id, Value>,
): IntentToEffect<Id, Value> {
  return (intent, state) => {
    switch (intent.intentType) {
      case 'setNormalBuffer':
        return normalBufferToEffectResult<Id, Value>(
          userNormalCommands,
          intent.normalBuffer,
        );

      case 'normalRight':
        return normalInteractRightToEffect(state, stateApi);

      case 'normalLeft':
        return normalInteractLeftToEffect(state, stateApi);

      case 'normalDown':
        return dispatchAction<Id, Value>({
          effectActionType: 'nextEntry',
        });

      case 'normalUp':
        return dispatchAction<Id, Value>({
          effectActionType: 'prevEntry',
        });

      case 'enterCommandLineMode':
        return {
          effectType: 'setInputState',
          inputState: {
            inputMode: 'command',
            commandLine: ':',
          },
        };

      case 'setCommandLine':
        return {
          effectType: 'setInputState',
          inputState: {
            inputMode: 'command',
            commandLine: intent.commandLine,
          },
        };

      case 'exitCommandLineMode': {
        return {
          effectType: 'setInputState',
          inputState: {
            inputMode: 'normal',
            normalBuffer: '',
          },
        };
      }

      // Clears and exits for empty commands, but emits error for unregistered
      // commands.
      case 'executeCommandLine': {
        return (
          parseExCommand(intent.commandLine, userExCommands) ?? {
            effectType: 'setInputState',
            inputState: {
              inputMode: 'normal',
              normalBuffer: '',
            },
          }
        );
      }
    }
  };
}

// =============================================================================
// Normal mode
// =============================================================================

function keepNormalBuffer<Id, Value>(normalBuffer: string): Effect<Id, Value> {
  return {
    effectType: 'setInputState',
    inputState: {
      inputMode: 'normal',
      normalBuffer,
    },
  };
}

function dispatchAction<Id, Value>(
  action: EffectAction<Id, Value>,
): Effect<Id, Value> {
  return {
    effectType: 'dispatchEffectAction',
    action,
  };
}

function clearBuffer<Id, Value>(): Effect<Id, Value> {
  return {
    effectType: 'setInputState',
    inputState: {
      inputMode: 'normal',
      normalBuffer: '',
    },
  };
}

/**
 * Sets the normal-mode command buffer.
 *
 * Three possibilities:
 *
 * - The buffer is a recognized motion: dispatch its effect action.
 * - The buffer is a prefix of a possible motion: retain it.
 * - The buffer is not a valid prefix: clear it.
 */
function normalBufferToEffectResult<Id, Value>(
  registeredNormalCommands: ReadonlySet<string>,
  updatedNormalBuffer: string,
): Effect<Id, Value> {
  if (registeredNormalCommands.has(updatedNormalBuffer)) {
    return {
      effectType: 'userNormalCommand',
      command: updatedNormalBuffer,
    };
  }

  const commandResult = parseNormalCommand<Id, Value>(updatedNormalBuffer);

  switch (commandResult.kind) {
    case 'incomplete':
      return keepNormalBuffer(updatedNormalBuffer);

    case 'complete':
      return dispatchAction(commandResult.action);

    case 'invalid':
      return clearBuffer();
  }
}

/**
 * Handles normal-mode right interaction.
 *
 * - A closed branch requests loading its children.
 * - An open branch dispatches an action that closes/unloads its children.
 * - A leaf has no right-interaction effect.
 */
function normalInteractRightToEffect<Id, Value>(
  state: State<Id, Value>,
  stateApi: StateMethods<Id, Value>,
): Effect<Id, Value> | undefined {
  const currentEntry = stateApi.getNodeAtCursor(state);

  if (currentEntry === undefined) {
    return undefined;
  }

  const path = stateApi.cursorPath(state);

  if (path === undefined) {
    return undefined;
  }

  switch (stateApi.treeMethods.kind(currentEntry)) {
    case 'unloaded-branch':
      return {
        effectType: 'loadBranchEntries',
        path,
      };

    case 'loaded-branch':
      return dispatchAction<Id, Value>({
        effectActionType: 'setBranchEntries',
        path,
        entries: null,
      });

    case 'leaf':
      return undefined;
  }
}

/**
 * Handles normal-mode left interaction.
 *
 * Left from the root has no effect. Otherwise dispatch navigation to the
 * parent entry.
 */
function normalInteractLeftToEffect<Id, Value>(
  state: State<Id, Value>,
  stateApi: StateMethods<Id, Value>,
): Effect<Id, Value> | undefined {
  if (stateApi.isCursorRoot(state)) {
    return undefined;
  }

  return dispatchAction<Id, Value>({
    effectActionType: 'navigateToParent',
  });
}
