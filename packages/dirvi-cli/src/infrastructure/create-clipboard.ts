import { spawn } from 'node:child_process';

type ClipboardCommand = Readonly<{
  executable: string;
  args: string[];
  encoding: 'utf8' | 'utf16le';
}>;

export function createClipboard(): ((value: string) => void) | undefined {
  let command: ClipboardCommand | undefined;

  if (process.platform === 'darwin') {
    command = { executable: 'pbcopy', args: [], encoding: 'utf8' };
  } else if (process.platform === 'win32') {
    command = { executable: 'clip.exe', args: [], encoding: 'utf16le' };
  } else if (process.platform === 'linux') {
    if (process.env.WAYLAND_DISPLAY) {
      command = {
        executable: 'wl-copy',
        args: ['--type', 'text/plain;charset=utf-8'],
        encoding: 'utf8',
      };
    } else if (process.env.DISPLAY) {
      command = {
        executable: 'xclip',
        args: ['-selection', 'clipboard'],
        encoding: 'utf8',
      };
    }
  }

  if (command === undefined) {
    return undefined;
  }

  const { executable, args, encoding } = command;

  // TODO: Add an optional error-first callback to report clipboard completion.
  // Invoke it at most once and update existing clipboard callers.
  return (value: string): void => {
    const child = spawn(executable, args, {
      stdio: ['pipe', 'ignore', 'ignore'],
    });

    let reported = false;
    const reportError = (message: string): void => {
      if (reported) {
        return;
      }

      reported = true;
      process.stderr.write(`dirvi: unable to copy to clipboard: ${message}\n`);
    };

    child.once('error', (error) => {
      reportError(error.message);
    });

    child.stdin.once('error', (error) => {
      reportError(error.message);
    });

    child.once('close', (code, signal) => {
      if (code !== 0) {
        reportError(
          signal === null
            ? `${executable} exited with code ${code}`
            : `${executable} terminated by signal ${signal}`,
        );
      }
    });

    // clip.exe needs a BOM to recognize UTF-16LE text.
    const input =
      encoding === 'utf16le'
        ? Buffer.from(`\uFEFF${value}`, 'utf16le')
        : Buffer.from(value, 'utf8');

    child.stdin.end(input);
  };
}
