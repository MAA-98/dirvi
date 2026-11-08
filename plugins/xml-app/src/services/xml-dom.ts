import type { XmlDocument, XmlDocumentChild, XmlElementChild, XmlNodePath } from '../domain/xml-doc.js';

export type XmlDom = {
  /**
   * Loads the document and its direct children. Element descendants are not
   * loaded: each direct child element has `children` undefined.
   */
  getDocument: () => XmlDocument;

  /**
   * Loads the direct children of the document or an element.
   * Child elements do not have their own children loaded.
   *
   * An empty path addresses the document. Each index selects a child in
   * document order.
   */
  getChildren: (
    path: XmlNodePath,
  ) => readonly (XmlDocumentChild | XmlElementChild)[];
};
