import { z } from 'zod';
import type {
  TreeNode,
  Cursor,
  State, FoldNode,
} from '../tree-surfer/index.js';
import {
  createTreeNodeApi,
  createCursorApi,
  createFoldNodeApi,
  createStateApi,
} from '../tree-surfer/index.js';
import { createNavNodeApi, NavNode } from '../tree-surfer/nav-node.js';
import { UnixPath } from './unix-path.js';

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

export const PosixName = {
  equals(first: PosixName, second: PosixName) {
    return first === second;
  },

  seqEqual(first: PosixName[], second: PosixName[]) {
    return (
      first.length === second.length &&
      first.every((name, index) => {
        const otherName = second[index];

        return otherName !== undefined && PosixName.equals(name, otherName);
      })
    );
  },
};

// PosixNode extends TreeNode
export type PosixNode =
  | {
      kind: 'file';
      name: PosixName;
    }
  | {
      kind: 'symlink';
      name: PosixName;
      target: UnixPath;
    }
  | {
      kind: 'directory';
      name: PosixName;
      branches: PosixNode[] | null;
    };

export const PosixNodeApi = createTreeNodeApi<PosixName, PosixNode>(
  PosixName.equals,
);

type Assert<True extends true> = True;

type PosixNodeIsTreeNode = Assert<
  PosixNode extends TreeNode<PosixName, PosixNode> ? true : false
>;

// Cursor
export type PosixCursor = Cursor<PosixName>;

export const PosixCursorApi = createCursorApi<PosixName>(PosixName.equals);

// Fold Node
export type PosixFoldNode = FoldNode<PosixName>;

export const PosixFoldNodeApi = createFoldNodeApi<PosixName>(
  PosixName.equals,
);

// Navigation Node
export type PosixNavNode = NavNode<PosixName, PosixNode>;

export const PosixNavApi = createNavNodeApi<PosixName, PosixNode>(
  PosixNodeApi,
  PosixFoldNodeApi,
  PosixCursorApi,
  PosixName.equals,
);

// State
export type PosixState = State<PosixName, PosixNode>;

export const PosixStateApi = createStateApi<PosixName, PosixNode>(
  PosixNodeApi,
  PosixFoldNodeApi,
  PosixCursorApi,
  PosixNavApi,
);