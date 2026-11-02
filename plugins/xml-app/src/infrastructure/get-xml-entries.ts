import { createHash } from 'node:crypto';

import {
  parseXml,
  XmlCdata,
  XmlComment,
  XmlDeclaration,
  XmlDocumentType,
  XmlElement,
  XmlProcessingInstruction,
  XmlText,
} from '@rgrove/parse-xml';
import type { XmlNode } from '@rgrove/parse-xml';
import type { AppChild, AppRoot } from 'dirvi-apis';

import type { XmlId, XmlNodeValue } from '../domain/xml-tree.js';
import { createXmlId } from '../domain/xml-tree.js';

// RFC 4122 URL namespace, used to derive deterministic version-5 UUIDs.
const uuidNamespace = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');

function nodeId(
  filePath: string,
  position: readonly number[],
  name: string,
): XmlId {
  const hash = createHash('sha1')
    .update(uuidNamespace)
    .update(JSON.stringify([filePath, position, name]), 'utf8')
    .digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // UUID version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC variant

  const hex = bytes.toString('hex');
  const uuid = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');

  return createXmlId(name, uuid);
}

function nodeName(node: XmlNode): string {
  if (
    node instanceof XmlElement ||
    node instanceof XmlProcessingInstruction ||
    node instanceof XmlDocumentType
  ) {
    return node.name;
  }

  if (node instanceof XmlText) return '#text';
  if (node instanceof XmlCdata) return '#cdata';
  if (node instanceof XmlComment) return '#comment';
  if (node instanceof XmlDeclaration) return '#declaration';

  throw new Error(`Unsupported XML node type "${node.type}".`);
}

function describeChild(
  filePath: string,
  position: readonly number[],
  node: XmlNode,
): AppChild<XmlId, XmlNodeValue> {
  const id = nodeId(filePath, position, nodeName(node));

  if (node instanceof XmlElement) {
    return {
      id,
      kind: 'unloaded-branch',
      value: {
        kind: 'element',
        name: node.name,
        attributes: Object.entries(node.attributes).map(([name, value]) => ({
          name,
          value,
        })),
      },
    };
  }

  if (node instanceof XmlText) {
    return { id, kind: 'leaf', value: { kind: 'text', text: node.text } };
  }

  if (node instanceof XmlCdata) {
    return { id, kind: 'leaf', value: { kind: 'cdata', text: node.text } };
  }

  if (node instanceof XmlComment) {
    return {
      id,
      kind: 'leaf',
      value: { kind: 'comment', text: node.content },
    };
  }

  if (node instanceof XmlProcessingInstruction) {
    return {
      id,
      kind: 'leaf',
      value: {
        kind: 'processing-instruction',
        target: node.name,
        data: node.content,
      },
    };
  }

  if (node instanceof XmlDeclaration) {
    return {
      id,
      kind: 'leaf',
      value: {
        kind: 'declaration',
        version: node.version,
        encoding: node.encoding,
        standalone: node.standalone,
      },
    };
  }

  if (node instanceof XmlDocumentType) {
    return {
      id,
      kind: 'leaf',
      value: {
        kind: 'doctype',
        name: node.name,
        publicId: node.publicId,
        systemId: node.systemId,
        internalSubset: node.internalSubset,
      },
    };
  }

  throw new Error(`Unsupported XML node type "${node.type}".`);
}

export function createXmlRoot(filePath: string): AppRoot<XmlId, XmlNodeValue> {
  return {
    id: nodeId(filePath, [], '#document'),
    value: { kind: 'document' },
  };
}

/**
 * Returns direct children in parser order. Paths are relative to the document
 * root; an empty path selects the document itself.
 */
export function getXmlEntries(
  filePath: string,
  source: string,
  path: readonly XmlId[],
): readonly AppChild<XmlId, XmlNodeValue>[] {
  const document = parseXml(source);
  let children: readonly XmlNode[] = document.children;
  let position: readonly number[] = [];

  for (const segment of path) {
    const index = children.findIndex(
      (node, i) =>
        nodeId(filePath, [...position, i], nodeName(node)) === segment,
    );

    if (index === -1) {
      throw new Error(`XML path not found: ${path.join(' / ')}`);
    }

    const node = children[index];
    if (!(node instanceof XmlElement)) {
      throw new Error(`XML path addresses a leaf: ${path.join(' / ')}`);
    }

    position = [...position, index];
    children = node.children;
  }

  return children.map((node, index) =>
    describeChild(filePath, [...position, index], node),
  );
}
