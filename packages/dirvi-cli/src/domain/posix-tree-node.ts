import { z } from 'zod';
import { UnixPath, UnixPathSchema } from './unix-path.js';
import {
  BranchTreeNode,
  createCursorApi,
  createCursorSchema,
  createFoldNodeSchemas, createFoldNodeService,
  createNavNodeApi,
  createStateApi,
  createStateSchema,
  createTreeNodeApi,
  createTreeNodeSchemas,
  Cursor,
  FoldNode,
  NavNode,
  serializableKeySchema,
  State,
  TreeNode,
} from 'dirvi-lib';

// For checking extensions
type Assert<True extends true> = True;

// --- PosixName extends PropertyKey ---

// Schema
export const PosixNameSchema = serializableKeySchema.pipe(
  z
    .string()
    .min(1, 'Entry name cannot be empty.')
    .refine((value) => !value.includes('/'), {
      message: "Entry name must not contain '/'.",
    })
    .refine((value) => value !== '.' && value !== '..', {
      message: "Entry name cannot be '.' or '..'.",
    }),
);

// Type
export type PosixName = z.output<typeof PosixNameSchema>;

// PosixName extends SerializableKey:
type PosixNameIsSerializableKey = Assert<
  PosixName extends string | number ? true : false
>;

// --- PosixTreeNode extends TreeNode ---

// Schema
export const PosixTreeNodeSchema: z.ZodType<PosixTreeNode> = z.lazy(() => {
  const { leafSchema, closedBranchSchema, openBranchSchema } =
    createTreeNodeSchemas(PosixNameSchema, PosixTreeNodeSchema);

  return z.union([
    leafSchema.extend({
      kind: z.literal('file'),
    }),

    leafSchema.extend({
      kind: z.literal('symlink'),
      target: UnixPathSchema,
    }),

    closedBranchSchema.extend({
      kind: z.literal('directory'),
    }),

    openBranchSchema.extend({
      kind: z.literal('directory'),
    }),
  ]);
});

export const PosixBranchTreeNodeSchema: z.ZodType<
  PosixTreeNode & BranchTreeNode<PosixName, PosixTreeNode>
> = PosixTreeNodeSchema.refine(
  (node): node is PosixTreeNode & BranchTreeNode<PosixName, PosixTreeNode> =>
    'children' in node,
  {
    message: 'The state root must be a branch node.',
  },
);

// Authoritative Type
export type PosixTreeNode =
  | {
      kind: 'file';
      id: PosixName;
    }
  | {
      kind: 'symlink';
      id: PosixName;
      target: UnixPath;
    }
  | {
      kind: 'directory';
      id: PosixName;
      children: PosixTreeNode[] | null;
    };

// Check PosixTreeNode extends TreeNode
type PosixTreeNodeIsTreeNode = Assert<
  PosixTreeNode extends TreeNode<PosixName, PosixTreeNode> ? true : false
>;

// API
export const PosixTreeNodeApi = createTreeNodeApi<PosixName, PosixTreeNode>();

// --- PosixFoldNode ---

// Schema
const foldNodeSchema = createFoldNodeSchemas<PosixName>(PosixNameSchema);
export const PosixFoldNodeSchema: z.ZodType<PosixFoldNode> = foldNodeSchema;
// Type
export type PosixFoldNode = FoldNode<PosixName>;
// API
export const PosixFoldNodeApi = createTreeNodeApi<PosixName, FoldNode<PosixName>>();
// Service
export const PosixFoldNodeService = createFoldNodeService<PosixName>(PosixFoldNodeApi)

// --- PosixCursor ---

// Schema
export const PosixCursorSchema: z.ZodType<PosixCursor> =
  createCursorSchema(PosixNameSchema);
// Type
export type PosixCursor = Cursor<PosixName>;
export const PosixCursorApi = createCursorApi<PosixName>();
// --- PosixNavNode ---
export type PosixNavNode = NavNode<PosixName>;
export const PosixNavApi = createNavNodeApi<PosixName, PosixTreeNode>(
  PosixTreeNodeApi,
  PosixFoldNodeService,
  PosixCursorApi,
);

// --- PosixState ---

// Schema
export const PosixStateSchema: z.ZodType<PosixState> = createStateSchema(
  PosixBranchTreeNodeSchema,
  PosixFoldNodeSchema,
  PosixCursorSchema,
);

// Type
export type PosixState = State<PosixName, PosixTreeNode>;

// API
export const PosixStateApi = createStateApi<PosixName, PosixTreeNode>(
  PosixTreeNodeApi,
  PosixFoldNodeApi,
  PosixCursorApi,
  PosixNavApi,
);
