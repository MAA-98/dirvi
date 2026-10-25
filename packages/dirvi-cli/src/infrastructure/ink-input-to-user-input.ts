import type { Key } from 'ink';

import type { UserInput } from 'dirvi-lib';

// Interprets raw user input to typed UserInput.
export function inkInputToUserInput(
  input: string,
  key: Key,
): UserInput | undefined {
  if (key.escape) {
    return {
      userInputType: 'esc',
    };
  }

  if (key.return) {
    return {
      userInputType: 'enter',
    };
  }

  if (key.backspace) {
    return {
      userInputType: 'backspace',
    };
  }

  if (key.rightArrow) {
    return {
      userInputType: 'rightArrow',
    };
  }

  if (key.leftArrow) {
    return {
      userInputType: 'leftArrow',
    };
  }

  if (key.upArrow) {
    return {
      userInputType: 'upArrow',
    };
  }

  if (key.downArrow) {
    return {
      userInputType: 'downArrow',
    };
  }

  if (input !== '') {
    return {
      userInputType: 'character',
      string: input,
    };
  }

  return undefined;
}
