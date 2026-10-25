import { describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import { createTreeMethods } from './tree.impl.js';
import type { TreeNode } from './tree.types.js';
import type { TreeNodeModel } from './tree-node.model.js';
import {
  childrenStateModelArb,
  modelAndBranchPathArb,
  modelAndReachablePathArb,
} from './tree-node.arb.js';

type TestNode = TreeNode<string, number>;
type TestModel = TreeNodeModel<string, number>;

const api = createTreeMethods<string, number>();

/**
 * Fail rather than silently skipping assertions when an operation that should
 * succeed returns undefined.
 */
function requireDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Expected a defined result');
  }

  return value;
}

function fromModel(model: TestModel): TestNode {
  return requireDefined(api.fromModel(model));
}

function loadedBranch(id: string, children: readonly TestNode[]): TestNode {
  return requireDefined(api.createLoadedBranch(id, 0, children));
}

describe('findChildById', () => {
  it('returns the existing matching direct child', () => {
    const child = api.createLeaf('child', 1);
    const root = loadedBranch('root', [child]);

    expect(api.findChildById(root, 'child')).toBe(child);
  });

  it('does not search descendants', () => {
    const descendant = api.createLeaf('descendant', 1);
    const child = loadedBranch('child', [descendant]);
    const root = loadedBranch('root', [child]);

    expect(api.findChildById(root, 'descendant')).toBeUndefined();
  });

  it.each([
    {
      name: 'an empty loaded branch',
      root: loadedBranch('root', []),
    },
    {
      name: 'a leaf',
      root: api.createLeaf('root', 0),
    },
    {
      name: 'an unloaded branch',
      root: api.createUnloadedBranch('root', 0),
    },
  ])('returns undefined for a missing child in $name', ({ root }) => {
    expect(api.findChildById(root, 'missing')).toBeUndefined();
  });
});

describe('findAtPath and selectAtPath', () => {
  it('resolves generated reachable paths', () => {
    fc.assert(
      fc.property(
        modelAndReachablePathArb,
        ({ root: rootModel, path, expected }) => {
          const root = fromModel(rootModel);
          const selected = requireDefined(api.findAtPath(root, path));

          expect(api.toModel(selected)).toStrictEqual(expected);

          expect(api.selectAtPath(root, path, (node) => node)).toBe(selected);

          expect(api.selectAtPath(root, path, (node) => api.id(node))).toBe(
            expected.id,
          );
        },
      ),
    );
  });

  it('calls the selector once with the existing resolved node', () => {
    const child = api.createLeaf('child', 1);
    const root = loadedBranch('root', [child]);
    const selector = vi.fn((node: TestNode) => api.id(node));

    expect(api.selectAtPath(root, ['child'], selector)).toBe('child');
    expect(selector).toHaveBeenCalledOnce();
    expect(selector).toHaveBeenCalledWith(child);
  });

  it('resolves the root for an empty path', () => {
    const root = api.createLeaf('root', 0);
    const selector = vi.fn((node: TestNode) => node);

    expect(api.findAtPath(root, [])).toBe(root);
    expect(api.selectAtPath(root, [], selector)).toBe(root);
    expect(selector).toHaveBeenCalledOnce();
    expect(selector).toHaveBeenCalledWith(root);
  });

  it.each([
    {
      name: 'a missing child',
      root: loadedBranch('root', []),
      path: ['missing'],
    },
    {
      name: 'a missing descendant',
      root: loadedBranch('root', [loadedBranch('child', [])]),
      path: ['child', 'missing'],
    },
    {
      name: 'a path through a leaf',
      root: loadedBranch('root', [api.createLeaf('child', 1)]),
      path: ['child', 'descendant'],
    },
    {
      name: 'a path through an unloaded branch',
      root: loadedBranch('root', [api.createUnloadedBranch('child', 1)]),
      path: ['child', 'descendant'],
    },
  ])(
    'returns undefined for $name without calling the selector',
    ({ root, path }) => {
      const selector = vi.fn((node: TestNode) => node);

      expect(api.findAtPath(root, path)).toBeUndefined();
      expect(api.selectAtPath(root, path, selector)).toBeUndefined();
      expect(selector).not.toHaveBeenCalled();
    },
  );

  it('returns undefined when the selector returns undefined', () => {
    const root = api.createLeaf('root', 0);
    const selector = vi.fn((_node: TestNode): string | undefined => undefined);

    expect(api.selectAtPath(root, [], selector)).toBeUndefined();
    expect(selector).toHaveBeenCalledOnce();
    expect(selector).toHaveBeenCalledWith(root);
  });
});

describe('updateAtPath', () => {
  it('replaces a generated node without changing the original tree', () => {
    fc.assert(
      fc.property(
        modelAndReachablePathArb,
        ({ root: rootModel, path, expected }) => {
          const root = fromModel(rootModel);
          const originalNode = requireDefined(api.findAtPath(root, path));
          const replacement = api.createLeaf(expected.id, expected.value);

          const updatedRoot = requireDefined(
            api.updateAtPath(root, path, () => replacement),
          );

          expect(api.findAtPath(updatedRoot, path)).toBe(replacement);

          expect(api.findAtPath(root, path)).toBe(originalNode);
          expect(api.toModel(root)).toStrictEqual(rootModel);
        },
      ),
    );
  });

  it('replaces child loading state at a generated branch path', () => {
    fc.assert(
      fc.property(
        modelAndBranchPathArb,
        childrenStateModelArb,
        ({ root: rootModel, path, expected }, newChildren) => {
          const root = fromModel(rootModel);
          const originalNode = requireDefined(api.findAtPath(root, path));

          const updatedRoot = requireDefined(
            api.updateAtPath(root, path, (node) =>
              newChildren === null
                ? api.toUnloadedBranch(node)
                : api.withLoadedChildren(node, newChildren.map(fromModel)),
            ),
          );

          const updatedNode = requireDefined(api.findAtPath(updatedRoot, path));

          expect(updatedNode).not.toBe(originalNode);
          expect(api.toModel(updatedNode)).toStrictEqual({
            id: expected.id,
            value: expected.value,
            children: newChildren,
          });

          expect(api.findAtPath(root, path)).toBe(originalNode);
          expect(api.toModel(root)).toStrictEqual(rootModel);
        },
      ),
    );
  });

  it('calls the updater once and preserves position when the ID changes', () => {
    const before = api.createLeaf('before', 1);
    const child = api.createLeaf('child', 2);
    const after = api.createLeaf('after', 3);
    const root = loadedBranch('root', [before, child, after]);

    const replacement = api.createLeaf('replacement', 4);
    const update = vi.fn(() => replacement);

    const updatedRoot = requireDefined(
      api.updateAtPath(root, ['child'], update),
    );

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(child);

    expect(api.findAtPath(updatedRoot, ['replacement'])).toBe(replacement);
    expect(api.findAtPath(updatedRoot, ['child'])).toBeUndefined();

    const children = [...requireDefined(api.getLoadedChildren(updatedRoot))];

    expect(children.map((node) => api.id(node))).toStrictEqual([
      'before',
      'replacement',
      'after',
    ]);
    expect(children[0]).toBe(before);
    expect(children[1]).toBe(replacement);
    expect(children[2]).toBe(after);

    expect(api.findAtPath(root, ['child'])).toBe(child);
  });

  it('rejects a replacement ID that duplicates a sibling ID', () => {
    const child = api.createLeaf('child', 1);
    const sibling = api.createLeaf('sibling', 2);
    const root = loadedBranch('root', [child, sibling]);

    const replacement = api.createLeaf('sibling', 3);
    const update = vi.fn(() => replacement);

    expect(api.updateAtPath(root, ['child'], update)).toBeUndefined();

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(child);

    expect(api.findAtPath(root, ['child'])).toBe(child);
    expect(api.findAtPath(root, ['sibling'])).toBe(sibling);
  });

  it('rebuilds ancestors while preserving unrelated node identities', () => {
    const target = api.createLeaf('target', 1);
    const sibling = api.createLeaf('sibling', 2);
    const branch = loadedBranch('branch', [target, sibling]);
    const otherBranch = loadedBranch('other', []);
    const root = loadedBranch('root', [branch, otherBranch]);

    const replacement = api.createLeaf('target', 3);

    const updatedRoot = requireDefined(
      api.updateAtPath(root, ['branch', 'target'], () => replacement),
    );

    expect(updatedRoot).not.toBe(root);
    expect(api.findAtPath(updatedRoot, ['branch'])).not.toBe(branch);

    expect(api.findAtPath(updatedRoot, ['branch', 'target'])).toBe(replacement);
    expect(api.findAtPath(updatedRoot, ['branch', 'sibling'])).toBe(sibling);
    expect(api.findAtPath(updatedRoot, ['other'])).toBe(otherBranch);

    expect(api.findAtPath(root, ['branch', 'target'])).toBe(target);
  });

  it('replaces the root for an empty path', () => {
    const root = api.createLeaf('root', 0);
    const replacement = api.createLeaf('replacement', 1);
    const update = vi.fn(() => replacement);

    expect(api.updateAtPath(root, [], update)).toBe(replacement);
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(root);
  });

  it.each([
    {
      name: 'a missing child',
      root: loadedBranch('root', []),
      path: ['missing'],
    },
    {
      name: 'a path through a leaf',
      root: api.createLeaf('root', 0),
      path: ['child'],
    },
    {
      name: 'a path through an unloaded branch',
      root: api.createUnloadedBranch('root', 0),
      path: ['child'],
    },
  ])(
    'returns undefined for $name without calling the updater',
    ({ root, path }) => {
      const update = vi.fn((node: TestNode) => node);

      expect(api.updateAtPath(root, path, update)).toBeUndefined();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'the root', path: [] },
    { name: 'a descendant', path: ['child'] },
  ])('returns undefined when updating $name is aborted', ({ path }) => {
    const child = api.createLeaf('child', 1);
    const root = loadedBranch('root', [child]);
    const selected = requireDefined(api.findAtPath(root, path));
    const update = vi.fn(() => undefined);

    expect(api.updateAtPath(root, path, update)).toBeUndefined();
    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(selected);
    expect(api.findAtPath(root, ['child'])).toBe(child);
  });
});
