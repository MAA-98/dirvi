import type {
  XmlDocument,
  XmlDocumentChild,
  XmlElementChild,
} from '../domain/xml-doc.js';
import { XmlId } from '../domain/xml-tree.js';

export type XmlDomEntry<Value> = {
  id: XmlId;
  value: Value;
};

export type XmlDom = {
  /** Returns the document and its ID. */
  getDocument: () => XmlDomEntry<XmlDocument>;

  /**
   * Loads direct children in document order.
   * Omitting the ID addresses the document.
   */
  getChildren: (
    id?: XmlId,
  ) => readonly XmlDomEntry<XmlDocumentChild | XmlElementChild>[];
};
