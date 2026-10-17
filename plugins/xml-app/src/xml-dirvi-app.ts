import type { AppPlugin } from 'dirvi-apis/plugin';

import { loadNodeXmlAppApi } from './infrastructure/load-node-xml-app-api.js';

/**
 * A dirvi app that exposes a POSIX filesystem as a navigable tree.
 */
export const xmlAppPlugin: AppPlugin = {
  createAppApiApplicator: (input) => {
    if (input === undefined) {
      throw new Error('xml-app: No file path to XML file given.')
    }
    
    const appApi = loadNodeXmlAppApi(input);

    return (appApiConsumer) => {
      return appApiConsumer(appApi);
    };
  },
};
