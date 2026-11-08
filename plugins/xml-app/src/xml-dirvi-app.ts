import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AppDefinition, AppPlugin } from 'dirvi-apis';

import type { XmlId, XmlNodeValue } from './domain/xml-tree.js';
import { xmlIdSchema, xmlValueSchema } from './domain/xml-tree.js';
import { createXmlFileResyncSubscription } from './infrastructure/create-xml-file-resync.js';
import { XmlDom } from './services/xml-dom.js';
import { createXmlDom } from './infrastructure/create-xml-dom.js';
import { createXmlRoot, getXmlEntries } from './infrastructure/get-xml-entries.js';

export const xmlAppPlugin: AppPlugin = {
  createAppDefinitionApplicator: (input) => {
    if (input === undefined) {
      throw new Error('xml-dirvi-app: No file path to XML file given.');
    }

    const xmlAbsolutePath = resolve(input);
    
    // Create dom async on first need, cache afterward
    let dom: XmlDom | undefined;
    let domPromise: Promise<XmlDom> | undefined;
    const getDom = async (): Promise<XmlDom> => {
      if (dom !== undefined) {
        return dom;
      }

      if (domPromise === undefined) {
        domPromise = readFile(xmlAbsolutePath, 'utf8')
          .then((source) => {
            dom = createXmlDom(source);
            return dom;
          })
          .finally(() => {
            domPromise = undefined;
          });
      }
      return domPromise;
    };

    const appDefinition = {
      semanticOrder: true,
      idSchema: xmlIdSchema,
      valueSchema: xmlValueSchema,

      loadChildren: async (path: readonly XmlId[]) => {
        const dom = await getDom();
        return getXmlEntries(xmlAbsolutePath, dom, path);
      },

      loadRoot: async () => {
        const dom = await getDom();
        return createXmlRoot(xmlAbsolutePath, dom.getDocument());
      },

      presentNode: (_id: XmlId, value: XmlNodeValue, isBranch: boolean) => ({
        content: value.kind,
        highlight: isBranch ? 'branch' : 'leaf',
      }),

      subscribeToResync: createXmlFileResyncSubscription(xmlAbsolutePath),
    } satisfies AppDefinition<XmlId, XmlNodeValue>;

    return (appDefinitionConsumer) => appDefinitionConsumer(appDefinition);
  },
};
