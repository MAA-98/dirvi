import { UserInput, InputState, Intent } from '../domain/index.js';

// Derive the intent from the user input and the current input state.
export function userInputToIntent(
  userInput: UserInput,
  inputState: InputState,
): Intent | undefined {
  switch (inputState.inputMode) {
    case 'normal':
      return normalUserInputToIntent(userInput, inputState.normalBuffer);

    case 'command':
      return commandUserInputToIntent(userInput, inputState.commandLine);
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
