export type InputModeState =
  | {
      inputMode: 'normal';
      normalBuffer: string;
    }
  | {
      inputMode: 'command';
      commandLine: string;
    };
