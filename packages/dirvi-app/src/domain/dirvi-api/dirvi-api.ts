import { ShellApi } from './shell-api.js';
import { AppApi } from './app-api.js';

/**
 * General API for performing actions in a running Dirvi session.
 *
 * This type describes the available actions; it does not implement them.
 * Dirvi must create an API object whose methods are backed by the live session.
 *
 * One use is in {@link PublicInitApi}: init.mjs can register closures that
 * receive this API and call its methods to perform actions. Dirvi passes the
 * object to a closure when it runs, not when it is registered.
 */
export type DirviApi = {
  shell: ShellApi;
  app: AppApi;
};
