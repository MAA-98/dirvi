import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { createTreeNodeApi } from './tree-node.impl.js';

import {
  forestAndPathAndExpectedArb,
  newBranchesOrNullArb,
  nodesArrayAndBranchPathArb,
} from './tree-node.arb.js';
import type { StringNode } from './tree-node.arb.js';

const stringNodeApi = createTreeNodeApi<string, StringNode>();

describe('tree node API', () => {
  it('getAtPath returns the node at the generated path', () => {
    fc.assert(
      fc.property(
        forestAndPathAndExpectedArb,
        ({ entries, path, expected }) => {
          expect(stringNodeApi.getAtPath(entries, path, (node) => node)).toBe(
            expected,
          );
        },
      ),
    );
  });

  it('getAtPath applies the selector', () => {
    const entries: StringNode[] = [
      {
        id: 'root',
        children: [{ id: 'child' }],
      },
    ];

    expect(
      stringNodeApi.getAtPath(entries, ['root', 'child'], (node) => node.id),
    ).toBe('child');
  });

  it('getAtPath returns undefined for an empty path', () => {
    const entries: StringNode[] = [{ id: 'root' }];

    expect(
      stringNodeApi.getAtPath(entries, [], (node) => node),
    ).toBeUndefined();
  });

  it('getAtPath returns undefined through a closed branch', () => {
    const entries: StringNode[] = [
      {
        id: 'root',
        children: null,
      },
    ];

    expect(
      stringNodeApi.getAtPath(entries, ['root', 'child'], (node) => node),
    ).toBeUndefined();
  });

  it('getAtPath returns undefined when the selector returns undefined', () => {
    const entries: StringNode[] = [{ id: 'root' }];

    expect(
      stringNodeApi.getAtPath(entries, ['root'], () => undefined),
    ).toBeUndefined();
  });

  it('getChildById returns the matching child', () => {
    const child: StringNode = { id: 'child' };

    const root: StringNode = {
      id: 'root',
      children: [child],
    };

    expect(stringNodeApi.isOpenBranch(root)).toBe(true);

    if (!stringNodeApi.isOpenBranch(root)) {
      return;
    }

    expect(stringNodeApi.getChildById(root, 'child')).toBe(child);
    expect(stringNodeApi.getChildById(root, 'missing')).toBeUndefined();
  });

  it('modifyAtPath replaces the generated node', () => {
    fc.assert(
      fc.property(
        forestAndPathAndExpectedArb,
        ({ entries, path, expected }) => {
          const replacement: StringNode = {
            id: expected.id,
          };

          const updatedForest = stringNodeApi.modifyAtPath(
            entries,
            path,
            () => replacement,
          );

          expect(updatedForest).not.toBeUndefined();

          if (updatedForest === undefined) {
            return;
          }

          expect(
            stringNodeApi.getAtPath(updatedForest, path, (node) => node),
          ).toBe(replacement);

          expect(stringNodeApi.getAtPath(entries, path, (node) => node)).toBe(
            expected,
          );
        },
      ),
    );
  });

  it('modifyAtPath replaces children at a branch path', () => {
    fc.assert(
      fc.property(
        nodesArrayAndBranchPathArb,
        newBranchesOrNullArb,
        ({ entries, path, expected }, newBranches) => {
          expect(stringNodeApi.isBranch(expected)).toBe(true);

          const updatedForest = stringNodeApi.modifyAtPath(
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

          const updatedNode = stringNodeApi.getAtPath(
            updatedForest,
            path,
            (node) => node,
          );

          expect(updatedNode).not.toBeUndefined();
          expect(updatedNode).not.toBe(expected);

          if (
            updatedNode === undefined ||
            !stringNodeApi.isBranch(updatedNode) ||
            (!stringNodeApi.isOpenBranch(updatedNode) && newBranches !== null)
          ) {
            return;
          }

          if (stringNodeApi.isOpenBranch(updatedNode)) {
            expect([...stringNodeApi.getChildren(updatedNode)]).toStrictEqual(
              newBranches,
            );
          }

          expect(stringNodeApi.getAtPath(entries, path, (node) => node)).toBe(
            expected,
          );
        },
      ),
    );
  });

  it('modifyAtPath returns undefined when the modifier aborts', () => {
    const entries: StringNode[] = [{ id: 'root' }];

    expect(
      stringNodeApi.modifyAtPath(entries, ['root'], () => undefined),
    ).toBeUndefined();
  });

  it('modifyAtPath returns undefined for an empty path', () => {
    const entries: StringNode[] = [{ id: 'root' }];

    expect(
      stringNodeApi.modifyAtPath(entries, [], (node) => node),
    ).toBeUndefined();
  });

  it('modifyAtPath returns undefined for an invalid path', () => {
    const entries: StringNode[] = [
      {
        id: 'root',
        children: [],
      },
    ];

    expect(
      stringNodeApi.modifyAtPath(entries, ['missing'], (node) => node),
    ).toBeUndefined();

    expect(
      stringNodeApi.modifyAtPath(entries, ['root', 'missing'], (node) => node),
    ).toBeUndefined();
  });

  it('modifyAtPath cannot traverse a closed branch', () => {
    const entries: StringNode[] = [
      {
        id: 'root',
        children: null,
      },
    ];

    expect(
      stringNodeApi.modifyAtPath(entries, ['root', 'child'], (node) => node),
    ).toBeUndefined();
  });
});
