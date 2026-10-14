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

/**
 * Returns the XDG user-configuration home directory.
 *
 * XDG_CONFIG_HOME must be absolute when set. Otherwise Dirvi follows the XDG
 * default of ~/.config.
 */
export function getXdgConfigHome(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;

  if (xdgConfigHome === undefined || xdgConfigHome.length === 0) {
    return join(homedir(), '.config');
  }

  if (!isAbsolute(xdgConfigHome)) {
    throw new Error(
      `XDG_CONFIG_HOME must be an absolute path, received "${xdgConfigHome}".`,
    );
  }

  return xdgConfigHome;
}
