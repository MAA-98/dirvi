import type {
  AppPlugin, AppPlugin2,
} from 'dirvi-apis/plugin';

import { createXmlFileResyncSubscription, loadNodeXmlAppApi } from './infrastructure/load-node-xml-app-api.js';
import { Position, XmlIdSchema, XmlNodeValueSchema } from './domain/xml-tree.js';
import { readFile } from 'node:fs/promises';
import { parseXmlDocument } from './infrastructure/parse-xml-document.js';
import { resolve } from 'node:path';
import { createNavNodeApi } from 'dirvi-lib';

/**
 * A dirvi app that exposes a POSIX filesystem as a navigable tree.
 */
export const xmlAppPlugin: AppPlugin = {
  createAppApiApplicator: (input) => {
    if (input === undefined) {
      throw new Error('xml-app: No file path to XML file given.');
    }

    const appApi = loadNodeXmlAppApi(input);

    return (appApiConsumer) => {
      return appApiConsumer(appApi);
    };
  },
};

/**
 * Creates applicator of AppDefinition.
 *
 * @param input - the absolute path to the XML file to open.
 */
export const xmlAppPlugin2: AppPlugin2 = {
  createAppDefinitionApplicator: (input) => {
    if (input === undefined) {
      throw new Error('xml-dirvi-app: No file path to XML file given.');
    }
    const xmlAbsolutePath = resolve(input);
    
    const appDefinition = {
      displayName: `XML: ${input}`,
      rootId: 0,
      idSchema: XmlIdSchema,
      valueSchema: XmlNodeValueSchema,
      createRoot: async () => {
        const source = await readFile(input, 'utf8');
        return parseXmlDocument(source);
      },
      loadChildren: async (path: readonly Position[]) => {
        // TODO Later: load from the file
        throw new Error(
          'Cannot load XML branches: parsed XML documents have no unloaded branches.',
        );
      },
      subscribeToResync: createXmlFileResyncSubscription(xmlAbsolutePath),
      createNavNodeApiOptions: {},
    };

    return (appDefinitionConsumer) => {
      return appDefinitionConsumer(appDefinition);
    };
  },
};
