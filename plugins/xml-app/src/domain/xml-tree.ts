import { z } from 'zod';
import type { TreeNode } from 'dirvi-lib';

// -----------------------------------------------------------------------------
// Node IDs
// -----------------------------------------------------------------------------

declare const xmlIdBrand: unique symbol;

/**
 * An opaque, reference-identity ID for a node in the current XML document.
 */
export type XmlId = object & { readonly [xmlIdBrand]: true };

// -----------------------------------------------------------------------------
// Node values
// -----------------------------------------------------------------------------

import type { XmlElement, XmlElementChild, XmlNode } from './xml-doc.js';

export type XmlNodeValue = XmlNode;
export type XmlTreeNode = TreeNode<XmlId, XmlNodeValue>;

const xmlNameSchema = z.object({
  qualifiedName: z.string(),
  localName: z.string(),
  prefix: z.string().nullable(),
  namespaceUri: z.string().nullable(),
});

const xmlAttributeSchema = z.object({
  name: xmlNameSchema,
  value: z.string(),
});

const xmlDeclarationSchema = z.object({
  kind: z.literal('declaration'),
  version: z.string(),
  encoding: z.string().nullable(),
  standalone: z.enum(['yes', 'no']).nullable(),
});

const xmlDoctypeSchema = z.object({
  kind: z.literal('doctype'),
  name: z.string(),
  publicId: z.string().nullable(),
  systemId: z.string().nullable(),
  internalSubset: z.string().nullable(),
});

const xmlTextSchema = z.object({
  kind: z.literal('text'),
  text: z.string(),
});

const xmlCdataSchema = z.object({
  kind: z.literal('cdata'),
  text: z.string(),
});

const xmlCommentSchema = z.object({
  kind: z.literal('comment'),
  text: z.string(),
});

const xmlProcessingInstructionSchema = z.object({
  kind: z.literal('processing-instruction'),
  target: z.string(),
  data: z.string(),
});

// Lazy because elements can contain other elements.
const xmlElementSchema = z.object({
  kind: z.literal('element'),
  name: xmlNameSchema,
  attributes: z.array(xmlAttributeSchema).readonly(),

  get children(): z.ZodExactOptional<
    z.ZodReadonly<z.ZodArray<z.ZodType<XmlElementChild>>>
  > {
    return z.array(xmlElementChildSchema).readonly().exactOptional();
  },
}) satisfies z.ZodType<XmlElement>;

const xmlElementChildSchema = z.union([
  xmlElementSchema,
  xmlTextSchema,
  xmlCdataSchema,
  xmlCommentSchema,
  xmlProcessingInstructionSchema,
]) satisfies z.ZodType<XmlElementChild>;

const xmlDocumentChildSchema = z.union([
  xmlDeclarationSchema,
  xmlDoctypeSchema,
  xmlElementSchema,
  xmlTextSchema,
  xmlCommentSchema,
  xmlProcessingInstructionSchema,
]);

const xmlDocumentSchema = z.object({
  kind: z.literal('document'),
  children: z.array(xmlDocumentChildSchema).readonly().exactOptional(),
});

export const xmlValueSchema = z.union([
  xmlDocumentSchema,
  xmlDeclarationSchema,
  xmlDoctypeSchema,
  xmlElementSchema,
  xmlTextSchema,
  xmlCdataSchema,
  xmlCommentSchema,
  xmlProcessingInstructionSchema,
]) satisfies z.ZodType<XmlNodeValue>;
