export type Intent = NormalModeIntent | CommandLineIntent;

export type NormalModeIntent =
  | {
      intentType: 'normalRight';
    }
  | {
      intentType: 'normalLeft';
    }
  | {
      intentType: 'normalDown';
    }
  | {
      intentType: 'normalUp';
    }
  | {
      intentType: 'setNormalBuffer';
      normalBuffer: string;
    };

export type CommandLineIntent =
  | {
      intentType: 'enterCommandLineMode';
    }
  | {
      intentType: 'setCommandLine';
      commandLine: string;
    }
  | {
      intentType: 'executeCommandLine';
      commandLine: string;
    }
  | {
      intentType: 'exitCommandLineMode';
    };
