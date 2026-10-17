import { readFile } from 'node:fs/promises';

import type { XmlTreeNode } from '../domain/xml-tree.js';
import { parseXmlDocument } from './parse-xml-document.js';

/**
 * Reads one UTF-8 XML file and parses it into the XML domain tree.
 */
export async function loadNodeXmlDocument(
  filePath: string,
): Promise<XmlTreeNode> {
  const source = await readFile(filePath, 'utf8');

  return parseXmlDocument(source);
}
