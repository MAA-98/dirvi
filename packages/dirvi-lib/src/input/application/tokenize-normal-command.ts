// =============================================================================
// Reader
// =============================================================================
type NormalBufferReader = {
  readonly normalBuffer: string;
  position: number;
};

function createNormalBufferReader(normalBuffer: string): NormalBufferReader {
  return {
    normalBuffer,
    position: 0,
  };
}

function peek(reader: NormalBufferReader): string | undefined {
  return reader.normalBuffer.at(reader.position);
}

function consume(reader: NormalBufferReader): string | undefined {
  const character = peek(reader);

  if (character !== undefined) {
    reader.position += 1;
  }

  return character;
}

// =============================================================================
// Tokenizer
// =============================================================================

export type ValidInteger = {
  tokenType: 'validInteger';
  value: number;
};

export type InvalidInteger = {
  tokenType: 'invalidInteger';
  value: string;
};

export type PartialCommand = {
  tokenType: 'partialCommand';
  commandType: 'fold';
};

export type FoldCommand = {
  tokenType: 'foldCommand';
  foldCommandType:
    | 'addToFoldTree'
    | 'removeFromFoldTree'
    | 'fold'
    | 'unfold'
    | 'toggleFold';
};

export type InvalidCommand = {
  tokenType: 'invalidCommand';
  value: string;
};

export type Token =
  | ValidInteger
  | InvalidInteger
  | PartialCommand
  | FoldCommand
  | InvalidCommand;

export type Tokens = readonly Token[];

function isDecimalDigit(character: string | undefined): character is string {
  if (character === undefined) {
    return false;
  }

  return character >= '0' && character <= '9';
}

export function tokenizeNormalCommand(normalBuffer: string): Tokens {
  const reader = createNormalBufferReader(normalBuffer);
  const tokens: Token[] = [];

  while (peek(reader) !== undefined) {
    if (isDecimalDigit(peek(reader))) {
      tokens.push(tokenizeInteger(reader));
    } else {
      tokens.push(tokenizeCommand(reader));
    }
  }

  return tokens;
}

function tokenizeInteger(
  reader: NormalBufferReader,
): ValidInteger | InvalidInteger {
  let value = '';

  while (true) {
    const character = peek(reader);

    if (!isDecimalDigit(character)) {
      break;
    }

    consume(reader);
    value += character;
  }

  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue)) {
    return {
      tokenType: 'invalidInteger',
      value,
    };
  }

  return {
    tokenType: 'validInteger',
    value: parsedValue,
  };
}

function tokenizeCommand(reader: NormalBufferReader): Token {
  const character = consume(reader);

  switch (character) {
    case 'z':
      return tokenizeFoldCommand(reader);

    default:
      return {
        tokenType: 'invalidCommand',
        value: character ?? '',
      };
  }
}

function tokenizeFoldCommand(reader: NormalBufferReader): Token {
  const character = consume(reader);

  if (character === undefined) {
    return {
      tokenType: 'partialCommand',
      commandType: 'fold',
    };
  }

  switch (character) {
    case 'f':
      return {
        tokenType: 'foldCommand',
        foldCommandType: 'addToFoldTree',
      };

    case 'd':
      return {
        tokenType: 'foldCommand',
        foldCommandType: 'removeFromFoldTree',
      };

    case 'c':
      return {
        tokenType: 'foldCommand',
        foldCommandType: 'fold',
      };

    case 'o':
      return {
        tokenType: 'foldCommand',
        foldCommandType: 'unfold',
      };

    case 'a':
      return {
        tokenType: 'foldCommand',
        foldCommandType: 'toggleFold',
      };

    default:
      return {
        tokenType: 'invalidCommand',
        value: `z${character}`,
      };
  }
}