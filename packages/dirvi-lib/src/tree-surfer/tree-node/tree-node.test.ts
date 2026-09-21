import { describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import { createTreeNodeApi } from './tree-node.impl.js';
import {
  newBranchesOrNullArb,
  nodesArrayAndBranchPathArb,
  nodeAndPathAndExpectedArb,
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
        nodeAndPathAndExpectedArb,
        ({ root, path, expected }) => {
          expect(api.getAtPath(root, path, (node) => node)).toBe(expected);
          expect(api.getAtPath(root, path, (node) => node.id)).toBe(expected.id);
        },
      ),
    );
  });
  
  it('UT: calls the selector once with the resolved node', () => {
    const child: StringNode = { id: 'child' };
    const root: StringNode = {
      id: 'root',
      children: [child],
    };

    const selector = vi.fn((node: StringNode) => node.id);
    
    expect(api.getAtPath(root, ['child'], selector)).toBe('child');
    expect(selector).toHaveBeenCalledOnce();
    expect(selector).toHaveBeenCalledWith(child);
  });
  
  it('UT: returns undefined for an invalid root path without calling the selector', () => {
    const selector = vi.fn((node: StringNode) => node.id);

    const result = api.getAtPath([{ id: 'root' }], ['missing'], selector);

    expect(result).toBeUndefined();
    expect(selector).not.toHaveBeenCalled();
  });
  
  it('UT: returns undefined when a child is missing from an open branch', () => {
    const root: StringNode = {
      id: 'root',
      children: [{ id: 'child' }],
    };

    const selector = vi.fn((node: StringNode) => node.id);

    const result = api.getAtPath(root, ['root', 'missing'], selector);

    expect(result).toBeUndefined();
    expect(selector).not.toHaveBeenCalled();
  });
  
  it('UT: resolves the root for an empty path', () => {
    const root: StringNode = { id: 'root' };
    const selector = vi.fn((node: StringNode) => node.id);

    expect(api.getAtPath(root, [], selector)).toBe('root');
    expect(selector).toHaveBeenCalledOnce();
    expect(selector).toHaveBeenCalledWith(root);
  });
  
  it('UT: returns undefined through a closed branch without calling the selector', () => {
    const root: StringNode = {
      id: 'root',
      children: null,
    };

    const selector = vi.fn((node: StringNode) => node.id);

    const result = api.getAtPath(root, ['child'], selector);

    expect(result).toBeUndefined();
    expect(selector).not.toHaveBeenCalled();
  });
  
  it('UT: returns undefined when the selector returns undefined', () => {
    const selector = vi.fn(
      (_node: StringNode): string | undefined => undefined,
    );

    const result = api.getAtPath({ id: 'root' }, [], selector);

    expect(result).toBeUndefined();
    expect(selector).toHaveBeenCalledOnce();
    expect(selector).toHaveBeenCalledWith({ id: 'root' });
  });
});

describe('modifyAtPath', () => {
  it('replaces the generated node', () => {
    fc.assert(
      fc.property(nodeAndPathAndExpectedArb, ({ root, path, expected }) => {
        const replacement: StringNode = {
          id: expected.id,
        };
        
        const updatedRoot = api.modifyAtPath(root, path, () => replacement);
        
        expect(updatedRoot).not.toBeUndefined();

        if (updatedRoot === undefined) {
          return;
        }

        expect(api.getAtPath(updatedRoot, path, (node) => node)).toBe(
          replacement,
        );

        expect(api.getAtPath(root, path, (node) => node)).toBe(expected);
      }),
    );
  }, 12000);

  it('replaces children at a branch path', () => {
    fc.assert(
      fc.property(
        nodesArrayAndBranchPathArb,
        newBranchesOrNullArb,
        ({ root, path, expected }, newBranches) => {
          expect(api.isBranch(expected)).toBe(true);
          
          const updatedRoot = api.modifyAtPath(
            root,
            path,
            (node) =>
              ({
                ...node,
                children: newBranches,
              }) as StringNode,
          );
          
          expect(updatedRoot).not.toBeUndefined();

          if (updatedRoot === undefined) {
            return;
          }

          const updatedNode = api.getAtPath(updatedRoot, path, (node) => node);
          
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

          expect(api.getAtPath(root, path, (node) => node)).toBe(expected);
        },
      ),
    );
  });
  
  it('UT: calls the modifier once with the resolved node', () => {
    const child: StringNode = { id: 'child' };
    const root: StringNode = {
      id: 'root',
      children: [child],
    };

    const replacement: StringNode = { id: 'replacement' };
    const modifier = vi.fn(() => replacement);
    
    const updatedRoot = api.modifyAtPath(root, ['child'], modifier);

    expect(updatedRoot).toBeDefined();
    expect(modifier).toHaveBeenCalledOnce();
    expect(modifier).toHaveBeenCalledWith(child);
    expect(
      api.getAtPath(updatedRoot!, ['replacement'], (node) => node),
    ).toBe(replacement);
    expect(
      api.getAtPath(updatedRoot!, ['child'], (node) => node),
    ).toBeUndefined();
  });
  
  it('UT: modifies the root for an empty path', () => {
    const root: StringNode = { id: 'root' };
    const replacement: StringNode = { id: 'replacement' };
    const modifier = vi.fn(() => replacement);

    const updatedRoot = api.modifyAtPath(root, [], modifier);

    expect(updatedRoot).toBe(replacement);
    expect(modifier).toHaveBeenCalledOnce();
    expect(modifier).toHaveBeenCalledWith(root);
  });
  
  it.each([
    {
      name: 'a missing child',
      root: {
        id: 'root',
        children: [],
      } as StringNode,
      path: ['missing'],
    },
    {
      name: 'a path through a leaf',
      root: {
        id: 'root',
      } as StringNode,
      path: ['child'],
    },
    {
      name: 'a path through a closed branch',
      root: {
        id: 'root',
        children: null,
      } as StringNode,
      path: ['child'],
    },
  ])(
    'UT: returns undefined and does not call the modifier',
    ({ root, path }) => {
      const modifier = vi.fn((node: StringNode) => node);

      const result = api.modifyAtPath(root, path, modifier);

      expect(result).toBeUndefined();
      expect(modifier).not.toHaveBeenCalled();
    },
  );
  
  it('UT: returns undefined when the modifier aborts', () => {
    const root: StringNode = { id: 'root' };
    const modifier = vi.fn(() => undefined);

    const result = api.modifyAtPath(root, [], modifier);

    expect(result).toBeUndefined();
    expect(modifier).toHaveBeenCalledOnce();
    expect(modifier).toHaveBeenCalledWith(root);
  });
});
