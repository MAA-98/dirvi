import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AppDefinition } from 'dirvi-apis';
import type { AppPlugin } from 'dirvi-apis/plugin';

import type { XmlId, XmlNodeValue } from './domain/xml-tree.js';
import { xmlIdSchema, xmlValueSchema } from './domain/xml-tree.js';
import { createXmlFileResyncSubscription } from './infrastructure/create-xml-file-resync.js';
import {
  createXmlRoot,
  getXmlEntries,
} from './infrastructure/get-xml-entries.js';

export const xmlAppPlugin: AppPlugin = {
  createAppDefinitionApplicator: (input) => {
    if (input === undefined) {
      throw new Error('xml-dirvi-app: No file path to XML file given.');
    }

    const xmlAbsolutePath = resolve(input);

    const appDefinition = {
      displayName: `XML: ${input}`,
      semanticOrder: true,
      idSchema: xmlIdSchema,
      valueSchema: xmlValueSchema,
      
      loadChildren: async (path: readonly XmlId[]) => {
        const source = await readFile(xmlAbsolutePath, 'utf8');
        return getXmlEntries(xmlAbsolutePath, source, path);
      },
      loadRoot: async () => createXmlRoot(xmlAbsolutePath),
      
      presentNode: (id: XmlId, isBranch: boolean) => ({
        content: id.slice(id.indexOf(':') + 1),
        highlight: isBranch ? 'branch' : 'leaf',
      }),

      subscribeToResync: createXmlFileResyncSubscription(xmlAbsolutePath),
    } satisfies AppDefinition<XmlId, XmlNodeValue>;

    return (appDefinitionConsumer) => appDefinitionConsumer(appDefinition);
  },
};
