import { z } from 'zod';
import { TreeNode } from '../tree-surfer/tree-node/tree-node.types.js';
import { UnixPath } from './unix-path.js';
import { createTreeNodeApi } from '../tree-surfer/tree-node/tree-node.impl.js';
import { createCursorApi, createStateApi, Cursor, State } from '../tree-surfer/index.js';
import { FoldNode } from '../tree-surfer/fold-node/fold-node.types.js';
import { createFoldNodeApi } from '../tree-surfer/fold-node/fold-node.impl.js';
import { NavNode } from '../tree-surfer/nav-node/nav-node.types.js';
import { createNavNodeApi } from '../tree-surfer/nav-node/nav-node.impl.js';

// Name
export const PosixNameSchema = z
  .string()
  .min(1)
  .refine((value) => !value.includes('/'), {
    message: "Entry name must not contain '/'",
  })
  .refine((value) => value !== '.' && value !== '..', {
    message: "Entry name cannot be '.' or '..'",
  });

export type PosixName = z.output<typeof PosixNameSchema>;

// PosixNode extends TreeNode
export type PosixNode =
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
      children: PosixNode[] | null;
    };

export const PosixNodeApi = createTreeNodeApi<PosixName, PosixNode>();

type Assert<True extends true> = True;

type PosixNodeIsTreeNode = Assert<
  PosixNode extends TreeNode<PosixName, PosixNode> ? true : false
>;

// Cursor
export type PosixCursor = Cursor<PosixName>;

export const PosixCursorApi = createCursorApi<PosixName>();

// Fold Node
export type PosixFoldNode = FoldNode<PosixName>;

export const PosixFoldNodeApi = createFoldNodeApi<PosixName>();

// Navigation Node
export type PosixNavNode = NavNode<PosixName, PosixNode>;

export const PosixNavApi = createNavNodeApi<PosixName, PosixNode>(
  PosixNodeApi,
  PosixFoldNodeApi,
  PosixCursorApi,
);

// State
export type PosixState = State<PosixName, PosixNode>;

export const PosixStateApi = createStateApi<PosixName, PosixNode>(
  PosixNodeApi,
  PosixFoldNodeApi,
  PosixCursorApi,
  PosixNavApi,
);