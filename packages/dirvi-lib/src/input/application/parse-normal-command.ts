import type { SerializableKey } from '../../trees/index.js';
import type { EffectAction } from '../domain/index.js';
import {
  tokenizeNormalCommand,
  type FoldCommand,
  type Token,
} from './tokenize-normal-command.js';

export type ParseNormalCommandResult<Id extends SerializableKey, Value> =
  | {
      kind: 'incomplete';
    }
  | {
      kind: 'complete';
      action: EffectAction<Id, Value>;
    }
  | {
      kind: 'invalid';
    };

export function parseNormalCommand<Id extends SerializableKey, Value>(
  normalBuffer: string,
): ParseNormalCommandResult<Id, Value> {
  const tokens = tokenizeNormalCommand(normalBuffer);

  if (tokens.some(isInvalidToken)) {
    return {
      kind: 'invalid',
    };
  }

  const [firstToken, secondToken] = tokens;

  if (firstToken === undefined) {
    return {
      kind: 'invalid',
    };
  }

  if (firstToken.tokenType === 'validInteger') {
    if (secondToken === undefined) {
      return {
        kind: 'incomplete',
      };
    }

    if (tokens.length !== 2) {
      return {
        kind: 'invalid',
      };
    }

    return tokenToResult<Id, Value>(secondToken, firstToken.value);
  }

  if (tokens.length !== 1) {
    return {
      kind: 'invalid',
    };
  }

  return tokenToResult<Id, Value>(firstToken, 0);
}

function isInvalidToken(token: Token): boolean {
  return (
    token.tokenType === 'invalidInteger' || token.tokenType === 'invalidCommand'
  );
}

function tokenToResult<Id extends SerializableKey, Value>(
  token: Token,
  index: number,
): ParseNormalCommandResult<Id, Value> {
  switch (token.tokenType) {
    case 'partialCommand':
      return {
        kind: 'incomplete',
      };

    case 'foldCommand':
      return {
        kind: 'complete',
        action: foldCommandToAction<Id, Value>(token, index),
      };

    case 'validInteger':
    case 'invalidInteger':
    case 'invalidCommand':
      return {
        kind: 'invalid',
      };
  }
}

function foldCommandToAction<Id extends SerializableKey, Value>(
  foldCommand: FoldCommand,
  index: number,
): EffectAction<Id, Value> {
  const foldTree = {
    foldTreeReferenceType: 'index' as const,
    index,
  };

  switch (foldCommand.foldCommandType) {
    case 'addToFoldTree':
      return {
        effectActionType: 'addToFoldTree',
        foldTree,
      };

    case 'removeFromFoldTree':
      return {
        effectActionType: 'removeFromFoldTree',
        foldTree,
      };

    case 'fold':
      return {
        effectActionType: 'fold',
        foldTree,
      };

    case 'unfold':
      return {
        effectActionType: 'unfold',
        foldTree,
      };

    case 'toggleFold':
      return {
        effectActionType: 'toggleFold',
        foldTree,
      };
  }
}