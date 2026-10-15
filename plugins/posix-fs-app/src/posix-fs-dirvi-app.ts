import type { AppPlugin } from 'dirvi-apis/plugin';

import { loadNodePosixAppApi } from './infrastructure/load-node-posix-app-api.js';

/**
 * A dirvi app that exposes a POSIX filesystem as a navigable tree.
 */
export const posixAppPlugin: AppPlugin = {
  createAppApiApplicator: (input) => {
    const appApi = loadNodePosixAppApi(input);

    return (appApiConsumer) => {
      return appApiConsumer(appApi);
    };
  },
};
