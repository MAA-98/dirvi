import { UserInput, InputModeState, Intent } from '../domain/index.js';

/**
 * By design "intent = input + mode + modeState", so it interprets the key
 * inputs depending on the mode and input so far. No context in terms of UI.
 *
 * @param userInput - the key user input.
 * @param inputModeState - the current mode and the user inputs so far.
 * @returns The user's intent.
 */
export function userInputToIntent(
  userInput: UserInput,
  inputModeState: InputModeState,
): Intent | undefined {
  switch (inputModeState.inputMode) {
    case 'normal':
      return normalUserInputToIntent(userInput, inputModeState.normalBuffer);

    case 'command':
      return commandUserInputToIntent(userInput, inputModeState.commandLine);
  }
}

function normalUserInputToIntent(
  userInput: UserInput,
  normalBuffer: string,
): Intent | undefined {
  if (userInput.userInputType === 'esc') {
    return {
      intentType: 'setNormalBuffer',
      normalBuffer: '',
    };
  }

  if (userInput.userInputType === 'character') {
    return normalCharacterToIntent(userInput.string, normalBuffer);
  }

  switch (userInput.userInputType) {
    case 'rightArrow':
      return {
        intentType: 'normalRight',
      };

    case 'leftArrow':
      return {
        intentType: 'normalLeft',
      };

    case 'downArrow':
      return {
        intentType: 'normalDown',
      };

    case 'upArrow':
      return {
        intentType: 'normalUp',
      };
  }
}

function normalCharacterToIntent(
  character: string,
  normalBuffer: string,
): Intent | undefined {
  if (normalBuffer === '') {
    switch (character) {
      case 'l':
        return {
          intentType: 'normalRight',
        };

      case 'h':
        return {
          intentType: 'normalLeft',
        };

      case 'j':
        return {
          intentType: 'normalDown',
        };

      case 'k':
        return {
          intentType: 'normalUp',
        };

      case ':':
        return {
          intentType: 'enterCommandLineMode',
        };
    }
  }

  return {
    intentType: 'setNormalBuffer',
    normalBuffer: normalBuffer + character,
  };
}

function commandUserInputToIntent(
  userInput: UserInput,
  commandLine: string,
): Intent | undefined {
  if (userInput.userInputType === 'esc') {
    return {
      intentType: 'exitCommandLineMode',
    };
  }

  if (userInput.userInputType === 'enter') {
    return {
      intentType: 'executeCommandLine',
      commandLine: commandLine,
    };
  }

  if (userInput.userInputType === 'backspace') {
    if (commandLine.length < 2) {
      return {
        intentType: 'exitCommandLineMode',
      };
    }
    return {
      intentType: 'setCommandLine',
      commandLine: commandLine.slice(0, -1),
    };
  }

  if (userInput.userInputType === 'character') {
    return {
      intentType: 'setCommandLine',
      commandLine: commandLine + userInput.string,
    };
  }
}
