import { createHash } from 'node:crypto';

import type { AppChild, AppRoot } from 'dirvi-apis';

import type { XmlDocument } from '../domain/xml-doc.js';
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

export function createXmlRoot(
  filePath: string,
  document: XmlDocument,
): AppRoot<XmlId, XmlNodeValue> {
  return {
    id: nodeId(filePath, [], '#document'),
    value: { kind: document.kind },
  };
}
