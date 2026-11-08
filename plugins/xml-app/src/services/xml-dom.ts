import type { XmlDocument } from '../domain/xml-doc.js';

export type XmlDom = {
  /**
   * Loads the document and its direct children. Element descendants are not
   * loaded: each direct child element has `children` undefined.
   */
  getDocument: () => XmlDocument;
};
