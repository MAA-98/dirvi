import { describe, expect, it } from 'vitest';

import { createTreeNodeApi } from '../tree-node/tree-node.impl.js';
import type { FoldNode, FoldNodeValue } from './fold-node.types.js';
import { createFoldNodeService } from './fold-node.impl.js';

const foldNodeApi = createTreeNodeApi<number, FoldNodeValue<number>>();

const service = createFoldNodeService(foldNodeApi);

function createFoldNode(
  id: number,
  options: Readonly<{
    children?: readonly FoldNode<number>[];
    foldedChildren?: readonly FoldNode<number>[];
  }> = {},
): FoldNode<number> {
  const node = foldNodeApi.createLoadedBranch(
    id,
    {
      foldedChildren: options.foldedChildren ?? [],
    },
    options.children ?? [],
  );

  if (node === undefined) {
    throw new Error('Test fixture has duplicate structural child IDs');
  }

  return node;
}

function getStructuralChildren(node: FoldNode<number>): FoldNode<number>[] {
  const children = foldNodeApi.getLoadedChildren(node);

  if (children === undefined) {
    throw new Error('Expected test FoldNode to be an open branch');
  }

  return [...children];
}

function getFoldedChildren(
  node: FoldNode<number>,
): readonly FoldNode<number>[] {
  return foldNodeApi.value(node).foldedChildren;
}

function expectFoldNode(
  node: FoldNode<number>,
  expected: Readonly<{
    id: number;
    childIds: readonly number[];
    foldedChildIds: readonly number[];
  }>,
): void {
  expect(foldNodeApi.id(node)).toBe(expected.id);

  expect(getStructuralChildren(node).map(foldNodeApi.id)).toStrictEqual(
    expected.childIds,
  );

  expect(getFoldedChildren(node).map(foldNodeApi.id)).toStrictEqual(
    expected.foldedChildIds,
  );
}

describe('createFoldNodeService', () => {
  it('UT: adds a new entry to folded children', () => {
    const root = service.createEmptyNode(0);

    const updated = service.addFoldedEntryAtPath(root, [], 0);

    expect(updated).toBeDefined();

    if (updated === undefined) {
      return;
    }

    expectFoldNode(updated, {
      id: 0,
      childIds: [],
      foldedChildIds: [0],
    });

    const foldedChild = getFoldedChildren(updated)[0];

    expect(foldedChild).toBeDefined();

    if (foldedChild === undefined) {
      return;
    }

    expectFoldNode(foldedChild, {
      id: 0,
      childIds: [],
      foldedChildIds: [],
    });
  });

  it('UT: moves an existing structural entry to folded children', () => {
    const child = createFoldNode(1);

    const root = createFoldNode(0, {
      children: [child],
    });

    const updated = service.addFoldedEntryAtPath(root, [], 1);

    expect(updated).toBeDefined();

    if (updated === undefined) {
      return;
    }

    expectFoldNode(updated, {
      id: 0,
      childIds: [],
      foldedChildIds: [1],
    });

    /*
     * Moving an existing child preserves the exact node value, including any
     * fold state nested below it.
     */
    expect(getFoldedChildren(updated)[0]).toBe(child);

    /*
     * The original immutable tree remains unchanged.
     */
    expectFoldNode(root, {
      id: 0,
      childIds: [1],
      foldedChildIds: [],
    });
  });

  it('UT: preserves nested fold state when moving an entry', () => {
    const nestedChild = createFoldNode(2);

    const child = createFoldNode(1, {
      foldedChildren: [nestedChild],
    });

    const root = createFoldNode(0, {
      children: [child],
    });

    const updated = service.addFoldedEntryAtPath(root, [], 1);

    expect(updated).toBeDefined();

    if (updated === undefined) {
      return;
    }

    expectFoldNode(updated, {
      id: 0,
      childIds: [],
      foldedChildIds: [1],
    });

    const movedChild = getFoldedChildren(updated)[0];

    expect(movedChild).toBe(child);

    if (movedChild === undefined) {
      return;
    }

    expectFoldNode(movedChild, {
      id: 1,
      childIds: [],
      foldedChildIds: [2],
    });

    expect(getFoldedChildren(movedChild)[0]).toBe(nestedChild);
  });

  it('UT: rejects a path through a folded entry', () => {
    const foldedChild = createFoldNode(1);

    const root = createFoldNode(0, {
      foldedChildren: [foldedChild],
    });

    const updated = service.addFoldedEntryAtPath(root, [1], 2);

    expect(updated).toBeUndefined();

    /*
     * The failed immutable operation leaves the original root untouched.
     */
    expectFoldNode(root, {
      id: 0,
      childIds: [],
      foldedChildIds: [1],
    });

    expect(getFoldedChildren(root)[0]).toBe(foldedChild);
  });
});
