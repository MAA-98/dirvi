#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { render } from 'ink';

import { Shell } from './ui/Shell.js';
import { loadNodeInit } from './infrastructure/load-node-init.js';
import { getXdgDataHome } from './infrastructure/get-xdg-data-home.js';
import { createNodeAppPackageInstaller } from './infrastructure/node-app-package-installer.js';
import { join } from 'node:path';

const program = new Command();

// =============================================================================
// Terminal Screen Setup
// =============================================================================
// Restore the terminal away from alternate screen during normal cleanup and as
// a last-resort fallback when Node is exiting.
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

// =============================================================================
// Resolving Paths
// =============================================================================
const dirviDataDirectory = join(getXdgDataHome(), 'dirvi');
const npmAppsDirectory = join(
  dirviDataDirectory,
  'site',
  'pack',
  'apps',
  'opt',
  'npm',
);

// =============================================================================
// Commands
// =============================================================================
program
  .name('direx')
  .description('View and manage directories.')
  .version('0.11.0-beta.1')
  .helpOption('--help')
  .option('-i, --input <value>', 'Input for the dirvi app at startup.')
  .action(async () => {
    // Input is a generic startup value supplied by the host; its interpretation
    // belongs to the selected app.
    const options = program.opts<{ input?: string }>();
    const init = await loadNodeInit({
      appPackageInstaller: createNodeAppPackageInstaller({
        appPackagesDirectory: npmAppsDirectory,
      }),
    });
    const initialApp = init.apps.find(
      (app) => app.id === init.initialAppId,
    );
    if (initialApp === undefined) {
      throw new Error(
        `Startup app "${init.initialAppId}" was selected but is not registered.`,
      );
    }
    const activeApp = initialApp.createAppApiCombinator(options.input);

    let appError: Error | undefined;

    const useAlternateScreen = uiOutput.isTTY === true;
    const stdoutIsInteractive = process.stdout.isTTY === true;
    if (useAlternateScreen) {
      uiOutput.write(enterAlternateScreen);
      alternateScreenActive = true;
    }

    const stdout = (message: string): void => {
      // The newline makes each message a separate JSON Lines message.
      // Note: if you pipe output you'll need to use FORCE_COLOR=1/2/3
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
        <Shell
          config={init.config}
          appApiCombinator={activeApp}
          {...(stdoutIsInteractive ? {} : { stdout })}
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

// =============================================================================
// App Runner
// =============================================================================
try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`direx error: ${message}\n`);
  process.exitCode = 1;
}
