import { createHash } from 'node:crypto';

import type { AppChild, AppRoot } from 'dirvi-apis';

import type {
  XmlChildNode,
  XmlDocument,
  XmlNodePath,
} from '../domain/xml-doc.js';
import type { XmlId, XmlNodeValue } from '../domain/xml-tree.js';
import { createXmlId } from '../domain/xml-tree.js';
import { XmlDom } from '../services/xml-dom.js';

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

function nodeName(node: XmlChildNode): string {
  switch (node.kind) {
    case 'element':
      return node.name.qualifiedName;
    case 'doctype':
      return node.name;
    case 'processing-instruction':
      return node.target;
    case 'declaration':
      return '#declaration';
    case 'text':
      return '#text';
    case 'cdata':
      return '#cdata';
    case 'comment':
      return '#comment';
  }
}

function describeChild(
  filePath: string,
  position: XmlNodePath,
  node: XmlChildNode,
): AppChild<XmlId, XmlNodeValue> {
  return {
    id: nodeId(filePath, position, nodeName(node)),
    kind: node.kind === 'element' ? 'unloaded-branch' : 'leaf',
    value: node,
  };
}

/**
 * Returns the direct children addressed by a dirvi path, in document order.
 */
export function getXmlEntries(
  filePath: string,
  dom: XmlDom,
  path: readonly XmlId[],
): readonly AppChild<XmlId, XmlNodeValue>[] {
  let position: XmlNodePath = [];

  for (const segment of path) {
    const children = dom.getChildren(position);
    const index = children.findIndex(
      (node, i) =>
        nodeId(filePath, [...position, i], nodeName(node)) === segment,
    );

    if (index === -1) {
      throw new Error(`XML path not found: ${path.join(' / ')}`);
    }

    const node = children[index];

    if (!node || node.kind !== 'element') {
      throw new Error(`XML path addresses a leaf: ${path.join(' / ')}`);
    }

    position = [...position, index];
  }

  return dom
    .getChildren(position)
    .map((node, index) => describeChild(filePath, [...position, index], node));
}

export function createXmlRoot(
  filePath: string,
  document: XmlDocument,
): AppRoot<XmlId, XmlNodeValue> {
  return {
    id: nodeId(filePath, [], '#document'),
    value: { kind: document.kind },
  };
}
