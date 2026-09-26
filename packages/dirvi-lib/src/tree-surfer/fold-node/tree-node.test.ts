import { describe, expect, it, vi } from 'vitest';

import { createTreeNodeApi } from '../tree-node/tree-node.impl.js';
import { FoldNode } from './fold-node.types.js';
import { createFoldNodeService } from './fold-node.impl.js';

const foldNodeApi = createTreeNodeApi<number, FoldNode<number>>();

const service = createFoldNodeService(foldNodeApi);

describe('createFoldNodeService', () => {
  it('UT: adds a new entry to foldedChildren', () => {
    const root = service.createEmptyNode(0);

    const updated = service.addFoldedEntryAtPath(root, [], 0);

    expect(updated).toStrictEqual({
      id: 0,
      children: [],
      foldedChildren: [
        {
          id: 0,
          children: [],
          foldedChildren: [],
        },
      ],
    });
  });

  it('UT: moves an existing structural entry to foldedChildren', () => {
    const child: FoldNode<number> = {
      id: 1,
      children: [],
      foldedChildren: [],
    };

    const root: FoldNode<number> = {
      id: 0,
      children: [child],
      foldedChildren: [],
    };

    const updated = service.addFoldedEntryAtPath(root, [], 1);

    expect(updated).toStrictEqual({
      id: 0,
      children: [],
      foldedChildren: [child],
    });
  });

  it('UT: preserves nested fold state when moving an entry', () => {
    const nestedChild: FoldNode<number> = {
      id: 2,
      children: [],
      foldedChildren: [],
    };

    const child: FoldNode<number> = {
      id: 1,
      children: [],
      foldedChildren: [nestedChild],
    };

    const root: FoldNode<number> = {
      id: 0,
      children: [child],
      foldedChildren: [],
    };

    const updated = service.addFoldedEntryAtPath(root, [], 1);

    expect(updated).toStrictEqual({
      id: 0,
      children: [],
      foldedChildren: [
        {
          id: 1,
          children: [],
          foldedChildren: [nestedChild],
        },
      ],
    });

    expect(updated?.foldedChildren[0]).toBe(child);
    expect(updated?.foldedChildren[0]?.foldedChildren[0]).toBe(nestedChild);
  });

  it('UT: rejects a path through a folded entry', () => {
    const foldedChild: FoldNode<number> = {
      id: 1,
      children: [],
      foldedChildren: [],
    };

    const root: FoldNode<number> = {
      id: 0,
      children: [],
      foldedChildren: [foldedChild],
    };

    const updated = service.addFoldedEntryAtPath(root, [1], 2);

    expect(updated).toBeUndefined();
    expect(root).toStrictEqual({
      id: 0,
      children: [],
      foldedChildren: [foldedChild],
    });
  });
});
