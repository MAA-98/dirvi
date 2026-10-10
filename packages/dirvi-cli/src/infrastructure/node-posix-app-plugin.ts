import type { AppPlugin } from '../application/app-plugin.js';
import { loadNodePosixAppApi } from './load-node-posix-app-api.js';

export const nodePosixAppPlugin: AppPlugin = {
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
