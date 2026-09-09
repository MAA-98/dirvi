#!/usr/bin/env node
import { Command } from 'commander';
import { render } from 'ink';

import { AppShell } from './ui/AppShell.js';

const program = new Command();

// ---*--- TERMINAL ALTERNATE SCREEN ---*---
// Restore the terminal away from alternate screen
// during normal cleanup and as a last-resort fallback
// when Node is exiting.

// Write UI to stderr
const uiOutput = process.stderr;

// The newline makes each message a separate JSON Lines message.
// Note: if you pipe output you'll need to use FORCE_COLOR=3
// to keep interactive screen colored.
const emitStdoutMsg = (message: string) => {
  process.stdout.write(message);
};

const enterAlternateScreen = '\u001b[?1049h\u001b[2J\u001b[H\u001b[?25l';
const leaveAlternateScreen = '\u001b[?25h\u001b[?1049l';

// Idempotent terminal restoration
let alternateScreenActive = false;
const restoreTerminal = () => {
  if (!alternateScreenActive) {
    return;
  }

  uiOutput.write(leaveAlternateScreen);
  alternateScreenActive = false;
};

// Node exit last resort
process.on('exit', restoreTerminal);

// ---*--- COMPOSITION ---*---
program
  .name('direx')
  .description('View and manage directories.')
  .version('0.4.0')
  .helpOption('--help')
  .option('-d, --directory <path>', 'Directory to browse')
  .action(async () => {
    const options = program.opts<{
      directory?: string;
    }>();

    let appError: Error | undefined;

    const useAlternateScreen = uiOutput.isTTY === true;

    if (useAlternateScreen) {
      uiOutput.write(enterAlternateScreen);
      alternateScreenActive = true;
    }

    try {
      const app = render(
        <AppShell
          directory={options.directory}
          print={process.stdout.isTTY ? undefined : emitStdoutMsg}
          onError={(error) => {
            appError = error;
          }}
        />,
        { stdout: uiOutput },
      );

      // Errors thrown while leaving this await still execute the finally block.
      await app.waitUntilExit();
    } finally {
      restoreTerminal(); // Always restore terminal regardless of error
    }

    // Re-throw an error reported by AppShell after the terminal
    // has been restored, so the outer catch can format it.
    if (appError !== undefined) {
      throw appError;
    }
  });

// ---*--- RUN AND HANDLE ERROR ---*---
try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`direx: ${message}\n`);
  process.exitCode = 1;
}
