import {
  DOMParser,
  Node,
  type DocumentType,
  type Element as XmldomElement,
  type Node as XmldomNode,
  type ProcessingInstruction as XmldomProcessingInstructions,
} from '@xmldom/xmldom';

import type {
  XmlDeclaration,
  XmlDocumentChild,
  XmlElement,
  XmlElementChild,
  XmlName,
  XmlNodePath,
} from '../domain/xml-doc.js';
import type { XmlDom } from '../services/xml-dom.js';

/**
 * Extract name for the domain type from xmldom.
 * @param node
 */
const toXmlName = (node: XmldomNode): XmlName => ({
  qualifiedName: node.nodeName,
  localName: node.localName ?? node.nodeName,
  prefix: node.prefix || null,
  namespaceUri: node.namespaceURI || null,
});

const getChildrenXmldomNode = (node: XmldomNode): XmldomNode[] => {
  const children: XmldomNode[] = [];

  for (let child = node.firstChild; child; child = child.nextSibling) {
    children.push(child);
  }

  return children;
};

/**
 * xmldom uses a ProcessingInstruction node for the XML declaration.
 * Map it to the domain's distinct XmlDeclaration type instead.
 */
const toXmlDeclaration = (
  node: XmldomProcessingInstructions,
): XmlDeclaration => {
  // xmldom represents the XML declaration as a processing instruction
  // with target "xml". Our domain models it as a separate node kind with
  // structured fields, so extract them from the instruction's data.
  const fields = new Map<string, string>();

  // Match each field name and its quoted value. The closing quote (\2)
  // must match the opening quote, allowing either single or double quotes.
  for (const match of (node.data ?? '').matchAll(
    /(version|encoding|standalone)[\t\n\r ]*=[\t\n\r ]*(['"])(.*?)\2/g,
  )) {
    fields.set(match[1], match[3]);
  }

  const version = fields.get('version');
  const standalone = fields.get('standalone');

  if (
    !version ||
    (standalone !== undefined && standalone !== 'yes' && standalone !== 'no')
  ) {
    throw new Error('Unsupported XML declaration');
  }

  return {
    kind: 'declaration',
    version,
    encoding: fields.get('encoding') ?? null,
    standalone: standalone ?? null,
  };
};

/**
 * Convert an xmldom doctype identifier to its unquoted domain value.
 * An empty value represents an absent identifier.
 */
const unquoteDoctypeId = (value: string): string | null => {
  if (!value) return null;

  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) {
    throw new Error(`Unexpected doctype identifier: ${value}`);
  }

  return value.slice(1, -1);
};

/**
 * Map an xmldom element and its attributes without loading its children.
 */
const toXmlElement = (node: XmldomElement): XmlElement => ({
  kind: 'element',
  name: toXmlName(node),
  attributes: Array.from(node.attributes, (attribute) => ({
    name: toXmlName(attribute),
    value: attribute.value,
  })),
});

const toXmlElementChild = (node: XmldomNode): XmlElementChild => {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      return toXmlElement(node as XmldomElement);

    case Node.TEXT_NODE:
      return { kind: 'text', text: node.nodeValue ?? '' };

    case Node.CDATA_SECTION_NODE:
      return { kind: 'cdata', text: node.nodeValue ?? '' };

    case Node.COMMENT_NODE:
      return { kind: 'comment', text: node.nodeValue ?? '' };

    case Node.PROCESSING_INSTRUCTION_NODE: {
      const instruction = node as XmldomProcessingInstructions;
      return {
        kind: 'processing-instruction',
        target: instruction.target,
        data: instruction.data ?? '',
      };
    }

    default:
      throw new Error(`Unsupported XML element child type: ${node.nodeType}`);
  }
};

const toXmlDocumentChild = (node: XmldomNode): XmlDocumentChild => {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      return toXmlElement(node as XmldomElement);

    case Node.TEXT_NODE:
      return { kind: 'text', text: node.nodeValue ?? '' };

    case Node.COMMENT_NODE:
      return { kind: 'comment', text: node.nodeValue ?? '' };

    case Node.DOCUMENT_TYPE_NODE: {
      const doctype = node as DocumentType;
      return {
        kind: 'doctype',
        name: doctype.name,
        publicId: unquoteDoctypeId(doctype.publicId),
        systemId: unquoteDoctypeId(doctype.systemId),
        internalSubset: doctype.internalSubset || null,
      };
    }

    case Node.PROCESSING_INSTRUCTION_NODE: {
      const instruction = node as XmldomProcessingInstructions;

      // xmldom uses a ProcessingInstruction node for the XML declaration.
      // Map it to the domain's distinct XmlDeclaration type instead.
      if (instruction.target === 'xml') {
        return toXmlDeclaration(instruction);
      }

      return {
        kind: 'processing-instruction',
        target: instruction.target,
        data: instruction.data ?? '',
      };
    }

    default:
      throw new Error(`Unsupported XML document child type: ${node.nodeType}`);
  }
};

/**
 * Creates the DOM service-level type.
 */
export const createXmlDom = (source: string): XmlDom => {
  const document = new DOMParser({
    onError: (level, message) => {
      if (level === 'error' || level === 'fatalError') {
        throw new Error(message);
      }
    },
  }).parseFromString(source, 'application/xml');

  return {
    getDocument: () => ({ kind: 'document' }),

    getChildren: (path: XmlNodePath) => {
      let node: XmldomNode = document;

      for (const index of path) {
        if (
          node.nodeType !== Node.DOCUMENT_NODE &&
          node.nodeType !== Node.ELEMENT_NODE
        ) {
          throw new Error(`XML path addresses a leaf: ${path.join(' / ')}`);
        }

        const child = getChildrenXmldomNode(node)[index];

        if (!child) {
          throw new Error(`XML path not found: ${path.join(' / ')}`);
        }

        node = child;
      }

      const children = getChildrenXmldomNode(node);

      if (node.nodeType === Node.DOCUMENT_NODE) {
        return children.map(toXmlDocumentChild);
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        return children.map(toXmlElementChild);
      }

      throw new Error(`XML path addresses a leaf: ${path.join(' / ')}`);
    },
  };
};
