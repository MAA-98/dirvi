export type InputState =
  | {
      inputMode: 'normal';
      normalBuffer: string;
    }
  | {
      inputMode: 'command';
      commandLine: string;
    };
