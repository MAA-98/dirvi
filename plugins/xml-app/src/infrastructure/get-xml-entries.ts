import {
  XmlCdata,
  XmlComment,
  XmlDeclaration,
  XmlDocumentType,
  XmlElement,
  XmlProcessingInstruction,
  XmlText,
} from '@rgrove/parse-xml';
import type { XmlNode } from '@rgrove/parse-xml';

import { createConstructors, XmlNodeValue, XmlTreeNode } from '../domain/xml-tree.js';
import {
  type Position,
  XmlTreeNode as XmlTreeNodeDomain,
} from '../domain/xml-tree.js';
import { TreeNodeApi } from 'dirvi-lib';

/**
 * Allocates unique XML tree IDs while one parsed document is converted.
 *
 * IDs identify nodes and cursor paths. They do not represent sibling order:
 * source child order is preserved by the TreeNode child sequence.
 */
export type CreatePosition = () => Position;

/**
 * Converts XML parser nodes into ordered Dirvi XML tree nodes.
 *
 * The returned array preserves parser child order exactly. In particular,
 * mixed content such as text, elements, comments, and CDATA remains in its
 * source-document order.
 */
export function getXmlEntries(
  treeNodeApi: TreeNodeApi<Position, XmlNodeValue>,
  xmlNodes: readonly XmlNode[],
  createPosition: CreatePosition,
): XmlTreeNode[] {
  return xmlNodes.map((xmlNode) => {
    const id = createPosition();
    const constructors = createConstructors(treeNodeApi);

    if (xmlNode instanceof XmlElement) {
      const children = getXmlEntries(
        treeNodeApi,
        xmlNode.children,
        createPosition,
      );

      const node = constructors.element(
        id,
        xmlNode.name,
        Object.entries(xmlNode.attributes).map(([name, value]) => ({
          name,
          value,
        })),
        children,
      );

      if (node === undefined) {
        throw new Error(
          `Cannot create XML element "${xmlNode.name}": duplicate child IDs.`,
        );
      }

      return node;
    }

    if (xmlNode instanceof XmlText) {
      return constructors.text(id, xmlNode.text);
    }

    if (xmlNode instanceof XmlCdata) {
      return constructors.cdata(id, xmlNode.text);
    }

    if (xmlNode instanceof XmlComment) {
      return constructors.comment(id, xmlNode.content);
    }

    if (xmlNode instanceof XmlProcessingInstruction) {
      return constructors.processingInstruction(
        id,
        xmlNode.name,
        xmlNode.content,
      );
    }

    if (xmlNode instanceof XmlDeclaration) {
      return constructors.declaration(
        id,
        xmlNode.version,
        xmlNode.encoding,
        xmlNode.standalone,
      );
    }

    if (xmlNode instanceof XmlDocumentType) {
      return constructors.doctype(
        id,
        xmlNode.name,
        xmlNode.publicId,
        xmlNode.systemId,
        xmlNode.internalSubset,
      );
    }

    throw new Error(`Unsupported XML node type "${xmlNode.type}".`);
  });
}
