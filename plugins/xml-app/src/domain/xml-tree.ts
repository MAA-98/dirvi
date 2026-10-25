import { z } from 'zod';
import type { SerializableKey, TreeNode, TreeMethods } from 'dirvi-lib';

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
// XmlNodeValue: node-attached value
// -----------------------------------------------------------------------------

// Types -----------------------------------------------------------------------

export type XmlAttribute = Readonly<{
  readonly name: string;
  readonly value: string;
}>;

export type XmlDocumentValue = Readonly<{
  readonly kind: 'document';
}>;

export type XmlDeclarationValue = Readonly<{
  readonly kind: 'declaration';
  readonly version: string;
  readonly encoding: string | null;
  readonly standalone: 'yes' | 'no' | null;
}>;

export type XmlDoctypeValue = Readonly<{
  readonly kind: 'doctype';
  readonly name: string;
  readonly publicId: string | null;
  readonly systemId: string | null;
  readonly internalSubset: string | null;
}>;

export type XmlElementValue = Readonly<{
  readonly kind: 'element';
  readonly name: string;
  readonly attributes: readonly XmlAttribute[];
}>;

export type XmlTextValue = Readonly<{
  readonly kind: 'text';
  readonly text: string;
}>;

export type XmlCommentValue = Readonly<{
  readonly kind: 'comment';
  readonly text: string;
}>;

export type XmlCdataValue = Readonly<{
  readonly kind: 'cdata';
  readonly text: string;
}>;

export type XmlProcessingInstructionValue = Readonly<{
  readonly kind: 'processing-instruction';
  readonly target: string;
  readonly data: string;
}>;

/**
 * XML semantics carried by a generic tree node.
 *
 * Child ordering is deliberately not represented here.
 */
export type XmlNodeValue =
  | XmlDocumentValue
  | XmlDeclarationValue
  | XmlDoctypeValue
  | XmlElementValue
  | XmlTextValue
  | XmlCommentValue
  | XmlCdataValue
  | XmlProcessingInstructionValue;

export type XmlTreeNode = TreeNode<XmlId, XmlNodeValue>;

// Schema ----------------------------------------------------------------------

export const XmlAttributeSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
}) satisfies z.ZodType<XmlAttribute>;

export const XmlDocumentValueSchema = z.object({
  kind: z.literal('document'),
}) satisfies z.ZodType<XmlDocumentValue>;

export const XmlElementValueSchema = z.object({
  kind: z.literal('element'),
  name: z.string().min(1),
  attributes: z.array(XmlAttributeSchema).readonly(),
}) satisfies z.ZodType<XmlElementValue>;

// TODO: add declaration and doctype when schema is needed

export const XmlTextValueSchema = z.object({
  kind: z.literal('text'),
  text: z.string(),
}) satisfies z.ZodType<XmlTextValue>;

export const XmlCommentValueSchema = z.object({
  kind: z.literal('comment'),
  text: z.string(),
}) satisfies z.ZodType<XmlCommentValue>;

export const XmlCdataValueSchema = z.object({
  kind: z.literal('cdata'),
  text: z.string(),
}) satisfies z.ZodType<XmlCdataValue>;

export const XmlProcessingInstructionValueSchema = z.object({
  kind: z.literal('processing-instruction'),
  target: z.string().min(1),
  data: z.string(),
}) satisfies z.ZodType<XmlProcessingInstructionValue>;

export const xmlValueSchema = z.discriminatedUnion('kind', [
  XmlDocumentValueSchema,
  XmlElementValueSchema,
  XmlTextValueSchema,
  XmlCommentValueSchema,
  XmlCdataValueSchema,
  XmlProcessingInstructionValueSchema,
]) satisfies z.ZodType<XmlNodeValue>;

// -----------------------------------------------------------------------------
// XML domain constructors
// -----------------------------------------------------------------------------

export function createConstructors(
  xmlTreeNodeApi: TreeMethods<XmlId, XmlNodeValue>,
) {
  return {
    document(
      id: XmlId,
      children: Iterable<XmlTreeNode>,
    ): XmlTreeNode | undefined {
      return xmlTreeNodeApi.createLoadedBranch(
        id,
        { kind: 'document' },
        children,
      );
    },

    declaration(
      id: XmlId,
      version: string,
      encoding: string | null,
      standalone: 'yes' | 'no' | null,
    ): XmlTreeNode {
      return xmlTreeNodeApi.createLeaf(id, {
        kind: 'declaration',
        version,
        encoding,
        standalone,
      });
    },

    doctype(
      id: XmlId,
      name: string,
      publicId: string | null,
      systemId: string | null,
      internalSubset: string | null,
    ): XmlTreeNode {
      return xmlTreeNodeApi.createLeaf(id, {
        kind: 'doctype',
        name,
        publicId,
        systemId,
        internalSubset,
      });
    },

    element(
      id: XmlId,
      name: string,
      attributes: readonly XmlAttribute[],
      children: Iterable<XmlTreeNode>,
    ): XmlTreeNode | undefined {
      return xmlTreeNodeApi.createLoadedBranch(
        id,
        {
          kind: 'element',
          name,
          attributes,
        },
        children,
      );
    },

    text(id: XmlId, text: string): XmlTreeNode {
      return xmlTreeNodeApi.createLeaf(id, {
        kind: 'text',
        text,
      });
    },

    comment(id: XmlId, text: string): XmlTreeNode {
      return xmlTreeNodeApi.createLeaf(id, {
        kind: 'comment',
        text,
      });
    },

    cdata(id: XmlId, text: string): XmlTreeNode {
      return xmlTreeNodeApi.createLeaf(id, {
        kind: 'cdata',
        text,
      });
    },

    processingInstruction(
      id: XmlId,
      target: string,
      data: string,
    ): XmlTreeNode {
      return xmlTreeNodeApi.createLeaf(id, {
        kind: 'processing-instruction',
        target,
        data,
      });
    },
  } as const;
}