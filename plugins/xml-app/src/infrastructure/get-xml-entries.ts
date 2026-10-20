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

import type { TreeNodeApi } from 'dirvi-lib';

import type {
  XmlNodeValue,
  XmlTreeNode,
} from '../domain/xml-tree.js';
import { createConstructors } from '../domain/xml-tree.js';
import type { XmlId } from '../domain/xml-tree.js';

/**
 * Allocates an XML tree ID containing the node's name and a unique UUID.
 *
 * IDs identify nodes and cursor paths. They do not represent sibling order:
 * source child order is preserved by the TreeNode child sequence.
 */
export type CreateXmlId = (name: string) => XmlId;

/**
 * Converts XML parser nodes into ordered Dirvi XML tree nodes.
 *
 * The returned array preserves parser child order exactly. In particular,
 * mixed content such as text, elements, comments, and CDATA remains in its
 * source-document order.
 */
export function getXmlEntries(
  treeNodeApi: TreeNodeApi<XmlId, XmlNodeValue>,
  xmlNodes: readonly XmlNode[],
  createXmlId: CreateXmlId,
): XmlTreeNode[] {
  return xmlNodes.map((xmlNode) => {
    const id = createXmlId(getXmlNodeName(xmlNode));
    const constructors = createConstructors(treeNodeApi);

    if (xmlNode instanceof XmlElement) {
      const children = getXmlEntries(
        treeNodeApi,
        xmlNode.children,
        createXmlId,
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

/**
 * Returns the XML name where one exists, otherwise a synthetic node label.
 *
 * Namespace prefixes are preserved, for example "svg:path".
 */
function getXmlNodeName(xmlNode: XmlNode): string {
  if (
    xmlNode instanceof XmlElement ||
    xmlNode instanceof XmlProcessingInstruction ||
    xmlNode instanceof XmlDocumentType
  ) {
    return xmlNode.name;
  }
  
  if (xmlNode instanceof XmlText) {
    return '#text';
  }
  
  if (xmlNode instanceof XmlCdata) {
    return '#cdata';
  }
  
  if (xmlNode instanceof XmlComment) {
    return '#comment';
  }
  
  if (xmlNode instanceof XmlDeclaration) {
    return '#declaration';
  }
  
  throw new Error(`Unsupported XML node type "${xmlNode.type}".`);
}