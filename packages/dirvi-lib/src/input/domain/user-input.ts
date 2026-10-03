export type UserInput =
  | {
      userInputType: 'character';
      string: string;
    }
  | {
      userInputType: 'enter';
    }
  | {
      userInputType: 'backspace';
    }
  | {
      userInputType: 'esc';
    }
  | {
      userInputType: 'rightArrow';
    }
  | {
      userInputType: 'leftArrow';
    }
  | {
      userInputType: 'downArrow';
    }
  | {
      userInputType: 'upArrow';
    };
