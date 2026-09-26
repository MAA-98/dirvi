import { describe, expect, it } from 'vitest';

import type { InputModeState, UserInput } from '../domain/index.js';
import { userInputToIntent } from './user-input-to-intent.js';

function normalInputState(normalBuffer = ''): InputModeState {
  return {
    inputMode: 'normal',
    normalBuffer,
  };
}

function commandInputState(commandLine = ':'): InputModeState {
  return {
    inputMode: 'command',
    commandLine,
  };
}

describe('userInputToIntent', () => {
  describe('normal mode', () => {
    it.each([
      ['l', { intentType: 'normalRight' }],
      ['h', { intentType: 'normalLeft' }],
      ['j', { intentType: 'normalDown' }],
      ['k', { intentType: 'normalUp' }],
      [':', { intentType: 'enterCommandLineMode' }],
    ] as const)(
      'converts "%s" to the expected intent',
      (character, expected) => {
        const userInput: UserInput = {
          userInputType: 'character',
          string: character,
        };

        expect(userInputToIntent(userInput, normalInputState())).toEqual(
          expected,
        );
      },
    );

    it('adds an unrecognized character to the normal buffer', () => {
      const userInput: UserInput = {
        userInputType: 'character',
        string: 'g',
      };

      expect(userInputToIntent(userInput, normalInputState())).toEqual({
        intentType: 'setNormalBuffer',
        normalBuffer: 'g',
      });
    });

    it('appends a character to an existing normal buffer', () => {
      const userInput: UserInput = {
        userInputType: 'character',
        string: 'g',
      };

      expect(userInputToIntent(userInput, normalInputState('2'))).toEqual({
        intentType: 'setNormalBuffer',
        normalBuffer: '2g',
      });
    });

    it('clears the normal buffer when Escape is pressed', () => {
      const userInput: UserInput = {
        userInputType: 'esc',
      };

      expect(userInputToIntent(userInput, normalInputState('gg'))).toEqual({
        intentType: 'setNormalBuffer',
        normalBuffer: '',
      });
    });

    it.each([
      ['rightArrow', 'normalRight'],
      ['leftArrow', 'normalLeft'],
      ['downArrow', 'normalDown'],
      ['upArrow', 'normalUp'],
    ] as const)('converts %s to %s', (userInputType, intentType) => {
      const userInput: UserInput = {
        userInputType,
      };

      expect(userInputToIntent(userInput, normalInputState())).toEqual({
        intentType,
      });
    });

    it('does not enter command-line mode when the normal buffer is non-empty', () => {
      const userInput: UserInput = {
        userInputType: 'character',
        string: ':',
      };

      expect(userInputToIntent(userInput, normalInputState('g'))).toEqual({
        intentType: 'setNormalBuffer',
        normalBuffer: 'g:',
      });
    });
  });

  describe('command-line mode', () => {
    it('appends a character to the command line', () => {
      const userInput: UserInput = {
        userInputType: 'character',
        string: 'w',
      };

      expect(userInputToIntent(userInput, commandInputState(':'))).toEqual({
        intentType: 'setCommandLine',
        commandLine: ':w',
      });
    });

    it('executes the command line when Enter is pressed', () => {
      const userInput: UserInput = {
        userInputType: 'enter',
      };

      expect(userInputToIntent(userInput, commandInputState(':w'))).toEqual({
        intentType: 'executeCommandLine',
        commandLine: ':w',
      });
    });

    it('exits command-line mode when Escape is pressed', () => {
      const userInput: UserInput = {
        userInputType: 'esc',
      };

      expect(userInputToIntent(userInput, commandInputState(':w'))).toEqual({
        intentType: 'exitCommandLineMode',
      });
    });

    it.each(['rightArrow', 'leftArrow', 'downArrow', 'upArrow'] as const)(
      'ignores %s in command-line mode',
      (userInputType) => {
        const userInput: UserInput = {
          userInputType,
        };

        expect(
          userInputToIntent(userInput, commandInputState()),
        ).toBeUndefined();
      },
    );
  });
});
