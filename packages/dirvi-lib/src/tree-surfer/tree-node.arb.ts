import * as fc from 'fast-check';

import type { TreeNode } from './tree-node.js';

// @ts-ignore
export type StringNode = TreeNode<string, StringNode>;

export type PathEntry = {
  path: string[];
  node: StringNode;
};

export type GeneratedNode = {
  node: StringNode;
  pathEntries: PathEntry[];
};

export const nameArb = fc.string({
  minLength: 1,
  maxLength: 8,
});

export const generatedNodeArb: fc.Arbitrary<GeneratedNode> = fc.letrec((tie) => ({
  node: fc.oneof(
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

    fc
      .tuple(
        nameArb,
        fc.oneof(
          fc.constant(null),
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

export const generatedNodesArrayArb = fc.uniqueArray(generatedNodeArb, {
  minLength: 0,
  size: 'small',
  selector: (generated) => generated.node.name,
});

export const forestAndPathsArb = generatedNodesArrayArb.map(
  (generatedNodes) => ({
    entries: generatedNodes.map((generated) => generated.node),
    pathEntries: generatedNodes.flatMap((generated) => generated.pathEntries),
  }),
);

export const forestAndPathAndExpectedArb = forestAndPathsArb
  .filter(({ pathEntries }) => pathEntries.length > 0)
  .chain(({ entries, pathEntries }) =>
    fc.constantFrom(...pathEntries).map(({ path, node }) => ({
      entries,
      path,
      expected: node,
    })),
  );

export const nodesArrayAndBranchPathArb = forestAndPathsArb
  .map(({ entries, pathEntries }) => ({
    entries,
    branchPathEntries: pathEntries.filter(({ node }) => 'branches' in node),
  }))
  .filter(({ branchPathEntries }) => branchPathEntries.length > 0)
  .chain(({ entries, branchPathEntries }) =>
    fc.constantFrom(...branchPathEntries).map(({ path, node }) => ({
      entries,
      path,
      expected: node,
    })),
  );

export const newBranchesArb = generatedNodesArrayArb.map((generatedNodes) =>
  generatedNodes.map(({ node }) => node),
);

export const newBranchesOrNullArb = fc.oneof(newBranchesArb, fc.constant(null));
