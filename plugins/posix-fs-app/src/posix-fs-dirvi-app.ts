import type { App } from 'dirvi-apis/plugin';

import { loadNodePosixAppApi } from './infrastructure/load-node-posix-app-api.js';

export type PosixAppOpenInput = {
  readonly directory?: string;
};

/**
 * A dirvi app that exposes a POSIX filesystem as a navigable tree.
 */
export const posixAppPlugin: App = {
  id: 'posix',

  createAppApiCombinator: (input) => {
    const appApi = loadNodePosixAppApi(input);

    return (appApiConsumer) => {
      return appApiConsumer(appApi);
    };
  },
};
