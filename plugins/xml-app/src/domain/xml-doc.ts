/**
 * An XML document contains one root element and may also contain an XML
 * declaration, a doctype, comments, and processing instructions. Elements
 * have attributes and ordered children; their children may include elements,
 * text, CDATA, comments, and processing instructions.
 *
 * These types model the document as a tree. Attributes belong to elements
 * rather than appearing as child nodes. Text and CDATA remain distinct node
 * kinds, and child order preserves mixed content.
 *
 * A document or element with `children` undefined has not had its children
 * loaded. An empty array means its children have been loaded and it has none.
 * These types describe the tree but do not enforce every XML validity rule.
 */

export type XmlNodePath = readonly number[];

/**
 * Used by both XML attributes and elements.
 */
export type XmlName = {
  qualifiedName: string;
  localName: string;
  prefix: string | null;
  namespaceUri: string | null;
};

export type XmlDocument = {
  kind: 'document';
  children?: readonly XmlDocumentChild[];
};

export type XmlDeclaration = {
  kind: 'declaration';
  version: string;
  encoding: string | null;
  standalone: 'yes' | 'no' | null;
};

export type XmlDoctype = {
  kind: 'doctype';
  name: string;
  publicId: string | null;
  systemId: string | null;
  internalSubset: string | null;
};

// ===========================
// Elements
// ===========================

export type XmlAttribute = {
  name: XmlName;
  value: string;
};

export type XmlElement = {
  kind: 'element';
  name: XmlName;
  attributes: readonly XmlAttribute[];
  children?: readonly XmlElementChild[];
};

export type XmlText = {
  kind: 'text';
  text: string;
};

export type XmlCdata = {
  kind: 'cdata';
  text: string;
};

export type XmlComment = {
  kind: 'comment';
  text: string;
};

export type XmlProcessingInstruction = {
  kind: 'processing-instruction';
  target: string;
  data: string;
};

export type XmlDocumentChild =
  | XmlDeclaration
  | XmlDoctype
  | XmlElement
  | XmlText
  | XmlComment
  | XmlProcessingInstruction;

export type XmlElementChild =
  | XmlElement
  | XmlText
  | XmlCdata
  | XmlComment
  | XmlProcessingInstruction;

export type XmlNode = XmlDocument | XmlDocumentChild | XmlElementChild;
