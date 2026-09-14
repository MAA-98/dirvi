#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';

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
  .version('0.6.0')
  .helpOption('--help')
  .option('-d, --directory <path>', 'Directory to browse')
  .action(async () => {
    const options = program.opts<{
      directory?: string;
    }>();

    let appError: Error | undefined;

    const useAlternateScreen = uiOutput.isTTY === true;
    const stdoutIsInteractive = process.stdout.isTTY === true;

    if (useAlternateScreen) {
      uiOutput.write(enterAlternateScreen);
      alternateScreenActive = true;
    }
    
    const stdout = (message: string): void => {
      // The newline makes each message a separate JSON Lines message.
      // Note: if you pipe output you'll need to use FORCE_COLOR=3
      // to keep interactive screen colored.
      process.stdout.write(`${message}\n`);
    };

    const clipboard = (value: string): void => {
      if (process.platform !== 'darwin') {
        return;
      }

      const child = spawn('pbcopy');

      child.once('error', (error) => {
        process.stderr.write(
          `direx: unable to copy to clipboard: ${error.message}\n`,
        );
      });

      child.stdin.end(value);
    };

    try {
      const app = render(
        <AppShell
          {...(options.directory === undefined
            ? {}
            : { directory: options.directory })}
          
          {...(stdoutIsInteractive
            ? {}
            : { stdout }
          )}
          clipboard={clipboard}
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
