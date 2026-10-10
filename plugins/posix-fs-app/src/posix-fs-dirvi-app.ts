import type { AppPlugin } from 'dirvi-apis/plugin';

import { loadNodePosixAppApi } from './infrastructure/load-node-posix-app-api.js';

export type PosixAppOpenInput = {
  readonly directory?: string;
};

/**
 * A dirvi app that exposes a POSIX filesystem as a navigable tree.
 */
export const posixAppPlugin: AppPlugin<PosixAppOpenInput> = {
  id: 'posix',

  open({ directory }) {
    const appApi = loadNodePosixAppApi(directory);

    return {
      withAppApi(renderer) {
        return renderer.render(appApi);
      },
    };
  },
};
