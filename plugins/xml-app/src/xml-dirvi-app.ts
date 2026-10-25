import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AppPlugin } from 'dirvi-apis/plugin';
import type { TreeMethods } from 'dirvi-lib';

import type { XmlId, XmlNodeValue } from './domain/xml-tree.js';
import { xmlIdSchema, xmlValueSchema } from './domain/xml-tree.js';
import { createXmlFileResyncSubscription } from './infrastructure/create-xml-file-resync.js';
import { createXmlId, parseXmlDocument } from './infrastructure/parse-xml-document.js';

/**
 * Creates applicator of `AppDefinition<Position, XmlValue>`.
 *
 * This style is used, instead of just creating the `AppDefinition`, for the
 * user of the package to be able to apply the AppDefinition without specifying
 * the generics.
 *
 * @param input - the path of the XML file to open.
 */
export const xmlAppPlugin: AppPlugin = {
  createAppDefinitionApplicator: (input) => {
    if (input === undefined) {
      throw new Error('xml-dirvi-app: No file path to XML file given.');
    }
    const xmlAbsolutePath = resolve(input);
    
    const appDefinition = {
      displayName: `XML: ${input}`,
      rootId: createXmlId('document'),
      semanticOrder: true,
      idSchema: xmlIdSchema,
      valueSchema: xmlValueSchema,
      createRoot: async (treeNodeApi: TreeMethods<XmlId, XmlNodeValue>) => {
        const source = await readFile(input, 'utf8');
        return parseXmlDocument(treeNodeApi, source);
      },
      loadChildren: async (
        treeNodeApi: TreeMethods<XmlId, XmlNodeValue>,
        path: readonly XmlId[],
      ) => {
        // TODO Later: load from the file
        throw new Error(
          'Cannot load XML branches: parsed XML documents have no unloaded branches.',
        );
      },
      presentNode: (id: XmlId, isBranch: boolean) => ({
        // Split at the first colon only, preserving names such as "svg:path".
        content: id.slice(id.indexOf(':') + 1),
        highlight: isBranch ? 'branch' : 'leaf',
      }),

      subscribeToResync: createXmlFileResyncSubscription(xmlAbsolutePath),
      createNavNodeApiOptions: {},
    };

    return (appDefinitionConsumer) => {
      return appDefinitionConsumer(appDefinition);
    };
  },
};
