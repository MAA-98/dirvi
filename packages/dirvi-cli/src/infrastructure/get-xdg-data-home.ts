import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

/**
 * Returns the XDG user-data home directory.
 *
 * XDG_DATA_HOME must be absolute when set. Otherwise Dirvi follows the XDG
 * default of ~/.local/share.
 */
export function getXdgDataHome(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;

  if (xdgDataHome === undefined || xdgDataHome.length === 0) {
    return join(homedir(), '.local', 'share');
  }

  if (!isAbsolute(xdgDataHome)) {
    throw new Error(
      `XDG_DATA_HOME must be an absolute path, received "${xdgDataHome}".`,
    );
  }

  return xdgDataHome;
}
