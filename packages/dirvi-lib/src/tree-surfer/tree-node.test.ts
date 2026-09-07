import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { createTreeNodeApi } from './tree-node.js';
import type { TreeNode } from './tree-node.js';

// -----------------------------------------------------------------------------
// Test types
// -----------------------------------------------------------------------------

// A concrete version of TreeNode using string names.
// @ts-ignore
type StringNode = TreeNode<string, StringNode>;

/**
 * A node together with the valid path leading to that node.
 *
 * For example, given this tree:
 *
 *   root
 *   └── child
 *
 * the generated path entries include:
 *
 *   { path: ['root'], node: root }
 *   { path: ['root', 'child'], node: child }
 */
type PathEntry = {
  path: string[];
  node: StringNode;
};

/**
 * Tree node generated plus useful path metadata.
 *
 * `node` is the actual tree node.
 * `pathEntries` contains that node and every descendant, paired with the valid
 * path from the node root.
 */
type GeneratedNode = {
  node: StringNode;
  pathEntries: PathEntry[];
};

// -----------------------------------------------------------------------------
// Test subject
// -----------------------------------------------------------------------------
const stringNodeApi = createTreeNodeApi<string, StringNode>(
  (left, right) => left === right,
);

// -----------------------------------------------------------------------------
// Arbitraries
// -----------------------------------------------------------------------------
const nameArb = fc.string({
  minLength: 1,
  maxLength: 8,
});

/**
 * Generates a recursive tree node together with all valid paths within that
 * node's subtree.
 */
const generatedNodeArb: fc.Arbitrary<GeneratedNode> = fc.letrec((tie) => ({
  node: fc.oneof(
    // -----------------------------------------------------------------------
    // Leaf
    // -----------------------------------------------------------------------

    nameArb.map((name) => {
      const node: StringNode = { name };

      return {
        node,
        pathEntries: [
          {
            path: [name],
            node,
          },
        ],
      };
    }),

    // -----------------------------------------------------------------------
    // Branch
    // -----------------------------------------------------------------------

    fc
      .tuple(
        nameArb,

        // A branch can either have unloaded children (`null`) or an array
        // of loaded child nodes.
        fc.oneof(
          fc.constant(null),

          // Sibling names must be unique, matching the tree invariant.
          fc.uniqueArray(tie('node'), {
            minLength: 0,
            size: 'medium',
            // @ts-ignore
            selector: (generated) => generated.node.name,
          }),
        ),
      )
      .map(([name, children]) => {
        const node: StringNode = {
          name,
          branches:
            // @ts-ignore
            children === null ? null : children.map((child) => child.node),
        };

        // Each child already knows about all paths within its own subtree.
        // Prefix those paths with this node's name to turn them into paths
        // relative to the overall generated tree.
        const descendantPathEntries =
          children === null
            ? []
            : children.flatMap((child) =>
                // @ts-ignore
                child.pathEntries.map(({ path, node }) => ({
                  path: [name, ...path],
                  node,
                })),
              );

        return {
          node,

          // Include the branch itself, followed by every descendant.
          pathEntries: [
            {
              path: [name],
              node,
            },
            ...descendantPathEntries,
          ],
        };
      }),
  ),
})).node;

/**
 * Generates an array of generated nodes.
 
 * Root node names are unique. The nested arbitrary already ensures that names
 * are unique among siblings.
 */
const generatedNodesArrayArb: fc.Arbitrary<GeneratedNode[]> = fc.uniqueArray(
  generatedNodeArb,
  {
    minLength: 0,
    size: 'small',
    selector: (generated) => generated.node.name,
  },
);

/**
 * Generates an array of nodes together with all valid paths in the forest
 * and the node at each path.
 */
const forestAndPathsArb = generatedNodesArrayArb.map((generatedNodes) => ({
  entries: generatedNodes.map((generated) => generated.node),
  pathEntries: generatedNodes.flatMap((generated) => generated.pathEntries),
}));

/**
 * Generates:
 *   - a forest (array of tree nodes),
 *   - a valid path in that forest (non-empty),
 *   - the expected node at the path.
 */
const forestAndPathAndExpectedArb = forestAndPathsArb
  .filter(({ pathEntries }) => pathEntries.length > 0)
  .chain(({ entries, pathEntries }) =>
    fc.constantFrom(...pathEntries).map(({ path, node }) => ({
      entries,
      path,
      expected: node,
    })),
  );

/**
 * Generates a valid path whose target is specifically a branch node.
 */
const nodesArrayAndBranchPathArb = forestAndPathsArb
  .map(({ entries, pathEntries }) => ({
    entries,
    branchPathEntries: pathEntries.filter(({ node }) =>
      stringNodeApi.isTreeNodeBranch(node),
    ),
  }))
  .filter(({ branchPathEntries }) => branchPathEntries.length > 0)
  .chain(({ entries, branchPathEntries }) =>
    fc.constantFrom(...branchPathEntries).map(({ path, node }) => ({
      entries,
      path,
      expected: node,
    })),
  );

/**
 * Generates a replacement branches array.
 *
 * Names are unique within the generated array, as required by the tree
 * invariant.
 */
const newBranchesArb = generatedNodesArrayArb.map((generatedNodes) =>
  generatedNodes.map(({ node }) => node),
);
const newBranchesOrNullArb = fc.oneof(newBranchesArb, fc.constant(null));

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------
describe('tree node API', () => {
  it('getAtPath returns the node at the generated path', () => {
    fc.assert(
      fc.property(
        forestAndPathAndExpectedArb,
        ({ entries, path, expected }) => {
          expect(stringNodeApi.getAtPath(entries, path)).toBe(expected);
        },
      ),
    );
  });

  it('setBranchesAtPath replaces the branches at the generated path', () => {
    fc.assert(
      fc.property(
        nodesArrayAndBranchPathArb,
        newBranchesOrNullArb,
        ({ entries, path, expected }, newBranches) => {
          expect(stringNodeApi.isTreeNodeBranch(expected)).toBe(true);

          const updatedForest = stringNodeApi.setBranchesAtPath(
            entries,
            path,
            newBranches,
          );

          expect(updatedForest).not.toBeUndefined();

          if (updatedForest === undefined) {
            return;
          }

          const updatedNode = stringNodeApi.getAtPath(updatedForest, path);

          expect(updatedNode).not.toBeUndefined();
          // Test immutability: new object is created
          expect(updatedNode).not.toBe(expected);

          if (
            updatedNode === undefined ||
            !stringNodeApi.isTreeNodeBranch(updatedNode)
          ) {
            return;
          }

          expect(stringNodeApi.getBranches(updatedNode)).toBe(newBranches);

          if (newBranches !== null) {
            for (const newBranch of newBranches) {
              expect(
                stringNodeApi.getAtPath(updatedForest, [
                  ...path,
                  newBranch.name,
                ]),
              ).toBe(newBranch);
            }
          }

          // The original forest still contains the old node.
          expect(stringNodeApi.getAtPath(entries, path)).toBe(expected);
        },
      ),
    );
  });

  it('setBranchesAtPath returns undefined when the target is a leaf', () => {
    const entries: StringNode[] = [{ name: 'leaf' }];

    expect(
      stringNodeApi.setBranchesAtPath(entries, ['leaf'], []),
    ).toBeUndefined();
  });

  it('setBranchesAtPath returns undefined for invalid paths', () => {
    const entries: StringNode[] = [
      {
        name: 'root',
        branches: [],
      },
    ];

    expect(stringNodeApi.setBranchesAtPath(entries, [], [])).toBeUndefined();

    expect(
      stringNodeApi.setBranchesAtPath(entries, ['missing'], []),
    ).toBeUndefined();

    expect(
      stringNodeApi.setBranchesAtPath(entries, ['root', 'missing'], []),
    ).toBeUndefined();
  });

  it('setBranchesAtPath returns undefined through intermediate unloaded branches', () => {
    const entries: StringNode[] = [
      {
        name: 'root',
        branches: null,
      },
    ];

    expect(
      stringNodeApi.setBranchesAtPath(entries, ['root', 'child'], []),
    ).toBeUndefined();
  });
});
