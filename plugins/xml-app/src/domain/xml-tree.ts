import { z } from 'zod';
import type { SerializableKey, TreeNode } from 'dirvi-lib';

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

type Assert<True extends true> = True;

// -----------------------------------------------------------------------------
// Position: Id extends SerializableKey
// -----------------------------------------------------------------------------

const uuidSchema = z.uuid();

/**
 * A node key containing its UUID and display name.
 *
 * This is not XML document order. XML sibling order is held by the source
 * TreeNode child sequence.
 *
 * Changing the name changes the complete tree key.
 */
export const xmlIdSchema = z.string().refine(
  (value) => {
    const separator = value.indexOf(':');

    return (
      separator > 0 &&
      uuidSchema.safeParse(value.slice(0, separator)).success &&
      value.slice(separator + 1).trim().length > 0
    );
  },
  {
    message: 'Expected an XML node ID in the form <uuid>:<node-name>.',
  },
);

export type XmlId = z.infer<typeof xmlIdSchema>;

type XmlIdIsSerializableKey = Assert<
  XmlId extends SerializableKey ? true : false
>;

export function createXmlId(name: string, uuid: string): XmlId {
  return xmlIdSchema.parse(`${uuid}:${name}`);
}

export function xmlIdName(id: XmlId): string {
  return id.slice(id.indexOf(':') + 1);
}

export function xmlIdUuid(id: XmlId): string {
  return id.slice(0, id.indexOf(':'));
}
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
