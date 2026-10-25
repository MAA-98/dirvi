import { randomUUID } from 'node:crypto';
import { parseXml } from '@rgrove/parse-xml';

import type { TreeMethods } from 'dirvi-lib';

import type { XmlId, XmlNodeValue, XmlTreeNode } from '../domain/xml-tree.js';
import { createConstructors, xmlIdSchema } from '../domain/xml-tree.js';
import { getXmlEntries } from './get-xml-entries.js';

export const createXmlId = (name: string): XmlId =>
  xmlIdSchema.parse(`${randomUUID()}:${name}`);

/**
 * Parses XML source into one Dirvi XML document tree.
 *
 * Each node receives an ID containing a fresh UUID and its node name.
 * Source child order is preserved by the TreeNode child sequence.
 */
export function parseXmlDocument(
  treeNodeApi: TreeMethods<XmlId, XmlNodeValue>,
  source: string,
): XmlTreeNode {
  const document = parseXml(source);
  
  const root = createConstructors(treeNodeApi).document(
    createXmlId('#document'),
    getXmlEntries(treeNodeApi, document.children, createXmlId),
  );

  if (root === undefined) {
    /*
     * Each node receives a fresh UUID, so duplicate child IDs would indicate
     * an ID collision or a defect in XML-to-domain conversion.
     */
    throw new Error('Cannot create XML document: duplicate child IDs.');
  }

  return root;
}
