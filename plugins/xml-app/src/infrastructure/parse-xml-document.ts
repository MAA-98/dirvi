import { parseXml } from '@rgrove/parse-xml';

import { TreeNodeApi } from 'dirvi-lib';

import { createConstructors, Position, XmlNodeValue, XmlTreeNode } from '../domain/xml-tree.js';
import { getXmlEntries } from './get-xml-entries.js';

/**
 * Parses XML source into one Dirvi XML document tree.
 *
 * The synthetic document root always receives ID 0. Descendants receive
 * monotonically allocated IDs in parser encounter order.
 */
export function parseXmlDocument(
  treeNodeApi: TreeNodeApi<Position, XmlNodeValue>,
  source: string,
): XmlTreeNode {
  const document = parseXml(source);

  let nextPosition = 1;

  const root = createConstructors(treeNodeApi).document(
    0,
    getXmlEntries(treeNodeApi, document.children, () => {
      const position = nextPosition;
      nextPosition += 1;

      return position;
    }),
  );

  if (root === undefined) {
    /*
     * Position allocation is unique, so this would indicate a defect in the
     * XML-to-domain conversion rather than invalid user XML.
     */
    throw new Error('Cannot create XML document: duplicate child IDs.');
  }

  return root;
}
