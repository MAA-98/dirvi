import { describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import { createTreeNodeApi } from './tree-node.impl.js';
import {
  newBranchesOrNullArb,
  nodesArrayAndBranchPathArb,
  nodesArrayAndPathAndExpectedArb,
  StringNode,
} from './tree-node.arb.js';

const api = createTreeNodeApi<string, StringNode>();

describe('getChildById', () => {
  it('UT: returns the matching direct child', () => {
    const child: StringNode = { id: 'child' };
    const root: StringNode = {
      id: 'root',
      children: [child],
    };

    expect(api.getChildById(root, 'child')).toBe(child);
  });

  it('UT: returns undefined for a missing child', () => {
    const root: StringNode = {
      id: 'root',
      children: [],
    };

    expect(api.getChildById(root, 'missing')).toBeUndefined();
  });
});

describe('getAtPath', () => {
  // Using `selector = vi.fn...` here is too heavy
  it('applies selector to the node at a valid path', () => {
    fc.assert(
      fc.property(
        nodesArrayAndPathAndExpectedArb,
        ({ entries, path, expected }) => {
          expect(api.getAtPath(entries, path, (node) => node)).toBe(expected);
          expect(api.getAtPath(entries, path, (node) => node.id)).toBe(
            expected.id,
          );
        },
      ),
    );
  });
  
  it('UT: calls the selector once with the resolved node', () => {
    const expected: StringNode = { id: 'child' };
    const entries: StringNode[] = [
      {
        id: 'root',
        children: [expected],
      },
    ];

    const selector = vi.fn((node: StringNode) => node.id);

    expect(api.getAtPath(entries, ['root', 'child'], selector)).toBe('child');
    expect(selector).toHaveBeenCalledOnce();
    expect(selector).toHaveBeenCalledWith(expected);
  });
  
  it('UT: returns undefined for an invalid root path without calling the selector', () => {
    const selector = vi.fn((node: StringNode) => node.id);

    const result = api.getAtPath([{ id: 'root' }], ['missing'], selector);

    expect(result).toBeUndefined();
    expect(selector).not.toHaveBeenCalled();
  });
  
  it('UT: returns undefined when a child is missing from an open branch', () => {
    const entries: StringNode[] = [
      {
        id: 'root',
        children: [{ id: 'child' }],
      },
    ];

    const selector = vi.fn((node: StringNode) => node.id);

    const result = api.getAtPath(entries, ['root', 'missing'], selector);

    expect(result).toBeUndefined();
    expect(selector).not.toHaveBeenCalled();
  });
  
  it('UT: returns undefined for an empty path without calling the selector', () => {
    const selector = vi.fn((node: StringNode) => node.id);

    const result = api.getAtPath([{ id: 'root' }], [], selector);

    expect(result).toBeUndefined();
    expect(selector).not.toHaveBeenCalled();
  });
  
  it('UT: returns undefined through a closed branch without calling the selector', () => {
    const entries: StringNode[] = [
      {
        id: 'root',
        children: null,
      },
    ];

    const selector = vi.fn((node: StringNode) => node.id);

    const result = api.getAtPath(entries, ['root', 'child'], selector);

    expect(result).toBeUndefined();
    expect(selector).not.toHaveBeenCalled();
  });
  
  it('UT: returns undefined when the selector returns undefined', () => {
    const selector = vi.fn(
      (_node: StringNode): string | undefined => undefined,
    );

    const result = api.getAtPath([{ id: 'root' }], ['root'], selector);

    expect(result).toBeUndefined();
    expect(selector).toHaveBeenCalledOnce();
    expect(selector).toHaveBeenCalledWith({ id: 'root' });
  });
});

describe('modifyAtPath', () => {
  it('replaces the generated node', () => {
    fc.assert(
      fc.property(
        nodesArrayAndPathAndExpectedArb,
        ({ entries, path, expected }) => {
          const replacement: StringNode = {
            id: expected.id,
          };

          const updatedForest = api.modifyAtPath(
            entries,
            path,
            () => replacement,
          );

          expect(updatedForest).not.toBeUndefined();

          if (updatedForest === undefined) {
            return;
          }

          expect(api.getAtPath(updatedForest, path, (node) => node)).toBe(
            replacement,
          );

          expect(api.getAtPath(entries, path, (node) => node)).toBe(expected);
        },
      ),
    );
  }, 10000);

  it('replaces children at a branch path', () => {
    fc.assert(
      fc.property(
        nodesArrayAndBranchPathArb,
        newBranchesOrNullArb,
        ({ entries, path, expected }, newBranches) => {
          expect(api.isBranch(expected)).toBe(true);

          const updatedForest = api.modifyAtPath(
            entries,
            path,
            (node) =>
              ({
                ...node,
                children: newBranches,
              }) as StringNode,
          );

          expect(updatedForest).not.toBeUndefined();

          if (updatedForest === undefined) {
            return;
          }

          const updatedNode = api.getAtPath(
            updatedForest,
            path,
            (node) => node,
          );

          expect(updatedNode).not.toBeUndefined();
          expect(updatedNode).not.toBe(expected);

          if (
            updatedNode === undefined ||
            !api.isBranch(updatedNode) ||
            (!api.isOpenBranch(updatedNode) && newBranches !== null)
          ) {
            return;
          }

          if (api.isOpenBranch(updatedNode)) {
            expect([...api.getChildren(updatedNode)]).toStrictEqual(
              newBranches,
            );
          }

          expect(api.getAtPath(entries, path, (node) => node)).toBe(
            expected,
          );
        },
      ),
    );
  });
  
  it('UT: calls the modifier once with the resolved node', () => {
    const child: StringNode = { id: 'child' };
    const entries: StringNode[] = [
      {
        id: 'root',
        children: [child],
      },
    ];

    const replacement: StringNode = { id: 'replacement' };
    const modifier = vi.fn(() => replacement);

    const updatedEntries = api.modifyAtPath(
      entries,
      ['root', 'child'],
      modifier,
    );

    expect(updatedEntries).toBeDefined();
    expect(modifier).toHaveBeenCalledOnce();
    expect(modifier).toHaveBeenCalledWith(child);
    expect(
      api.getAtPath(updatedEntries!, ['root', 'replacement'], (node) => node),
    ).toBe(replacement);
    expect(
      api.getAtPath(updatedEntries!, ['root', 'child'], (node) => node),
    ).toBeUndefined();
  });
  
  it.each([
    {
      name: 'an empty path',
      entries: [{ id: 'root' }] as StringNode[],
      path: [] as string[],
    },
    {
      name: 'a missing root',
      entries: [{ id: 'root' }] as StringNode[],
      path: ['missing'],
    },
    {
      name: 'a missing child',
      entries: [
        {
          id: 'root',
          children: [{ id: 'child' }],
        },
      ] as StringNode[],
      path: ['root', 'missing'],
    },
    {
      name: 'a path through a leaf',
      entries: [{ id: 'root' }] as StringNode[],
      path: ['root', 'child'],
    },
    {
      name: 'a path through a closed branch',
      entries: [{ id: 'root', children: null }] as StringNode[],
      path: ['root', 'child'],
    },
  ])('UT: returns undefined and does not call the modifier', ({ entries, path }) => {
    const modifier = vi.fn((node: StringNode) => node);

    const result = api.modifyAtPath(entries, path, modifier);

    expect(result).toBeUndefined();
    expect(modifier).not.toHaveBeenCalled();
  });
  
  it('UT: returns undefined when the modifier aborts', () => {
    const root: StringNode[] = [{ id: 'root' }];
    const modifier = vi.fn(() => undefined);
    const result = api.modifyAtPath(root, ['root'], modifier);

    expect(result).toBeUndefined();
    expect(modifier).toHaveBeenCalledOnce();
    expect(modifier).toHaveBeenCalledWith(root[0]);
  });
});
