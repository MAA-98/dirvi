import * as fc from 'fast-check';

import type { TreeNode } from './tree-node.types.js';

/**
 * The ID type used by the generated test trees.
 *
 * Short strings keep generated counterexamples readable.
 */
type TestNodeId = string;

/**
 * Characters used by readable generated node IDs.
 */
const smallLetterCharacters = Array.from(
  'abcdefghijklmnopqrstuvwxyz',
);

/**
 * Generates valid string IDs for test nodes. Note that the API just does
 * comparisons on the IDs so we can safely restrict to any subset.
 */
export const testIdArb = fc.string({
  unit: fc.constantFrom(...smallLetterCharacters),
  minLength: 1,
  maxLength: 8,
});

/**
 * Tree node whose IDs are strings, without additional domain properties.
 */
// @ts-expect-error Recursive type aliases are not fully inferred here.
export type StringNode = TreeNode<TestNodeId, StringNode>;
type Path = TestNodeId[];

type NodeAtPath = {
  path: Path;
  node: StringNode;
};

type NodeWithReachableNodes = {
  node: StringNode;
  reachableNodes: NodeAtPath[];
};

/**
 * Generates the metadata for a leaf node.
 *
 * @param id - The ID assigned to the leaf.
 * @returns The leaf and the path that resolves to it.
 */
const generatedLeafNodeWithReachableNodes = (id: TestNodeId): NodeWithReachableNodes => {
  const node: StringNode = { id };

  return {
    node,
    reachableNodes: [{ path: [id], node }],
  };
};

/**
 * Generates the metadata for a closed branch.
 *
 * A closed branch contributes no descendant paths because its children are not
 * loaded.
 *
 * @param id - The ID assigned to the branch.
 * @returns The closed branch and the path that resolves to it.
 */
const generatedClosedBranchWithReachableNodes = (
  id: TestNodeId,
): NodeWithReachableNodes => {
  const node: StringNode = {
    id,
    children: null,
  };
  
  return {
    node,
    reachableNodes: [{ path: [id], node }],
  };
};

/**
 * Generates the metadata for an open branch and its descendants.
 *
 * @param id - The ID assigned to the branch.
 * @param children - The generated children of the branch.
 * @returns The open branch and paths to the branch and all its descendants.
 */
const generatedOpenBranchWithReachableNodes = (
  id: TestNodeId,
  children: NodeWithReachableNodes[],
): NodeWithReachableNodes => {
  const node: StringNode = {
    id,
    children: children.map(({ node }) => node),
  };
  
  const descendantNodes = children.flatMap(
    ({ reachableNodes }) =>
      reachableNodes.map(({ path, node }) => ({
        path: [id, ...path],
        node,
      })),
  );
  
  return {
    node,
    reachableNodes: [
      { path: [id], node },
      ...descendantNodes,
    ],
  };
};

/**
 * Generates a leaf node.
 */
export const generatedLeafNodeArb = testIdArb.map(
  generatedLeafNodeWithReachableNodes,
);

/**
 * Generates a closed branch.
 */
export const generatedClosedBranchNodeArb = testIdArb.map(
  generatedClosedBranchWithReachableNodes,
);

/**
 * Generates a leaf or a closed branch.
 *
 * These node types terminate a generated path because they have no reachable
 * descendants.
 */
const generatedTerminalNodeArb = fc.oneof(
  generatedLeafNodeArb,
  generatedClosedBranchNodeArb,
);

/**
 * Generates a leaf, an open branch, or a closed branch.
 *
 * Open branches have unique child IDs. Root IDs are made unique separately
 * when generating a forest.
 *
 * The weighted choice gives recursive open branches a geometric dropoff.
 */
export const generatedNodeArb: fc.Arbitrary<NodeWithReachableNodes> = fc.letrec(
  (tie) => {
    const generatedChildNodeArb = tie(
      'node',
    ) as fc.Arbitrary<NodeWithReachableNodes>;

    /**
     * Generates the loaded children of an open branch.
     *
     * Sibling IDs must be unique so that child lookup is unambiguous. The
     * maximum length also limits the branching factor of recursive examples.
     */
    const generatedOpenChildrenArb = fc.uniqueArray(generatedChildNodeArb, {
      minLength: 0,
      maxLength: 4,
      size: 'medium',
      selector: ({ node }) => node.id,
    });

    /**
     * Generates an open branch and its reachable descendants.
     */
    const generatedOpenBranchNodeArb = fc
      .tuple(testIdArb, generatedOpenChildrenArb)
      .map(([id, children]) =>
        generatedOpenBranchWithReachableNodes(id, children),
      );

    return {
      node: fc
        .integer({
          min: 0,
          max: 9999,
        })
        .chain((choice) =>
          // 5046 works for getAtPath tests, but too heavy for modifyAtPath tests
          choice >= 5050
            ? generatedOpenBranchNodeArb
            : generatedTerminalNodeArb,
        ),
    };
  },
).node;

/**
 * Generates an array of generated nodes with unique IDs suitable for use as
 * the root of a forest.
 *
 * Root IDs must be unique because paths begin by looking up an ID in this
 * array.
 */
export const generatedNodesArrayArb = fc.uniqueArray(generatedNodeArb, {
  minLength: 0,
  size: 'small',
  selector: (generated) => generated.node.id,
});

/**
 * An array of root-level nodes and all paths that can be resolved through
 * those nodes.
 *
 * Paths through closed branches stop at the closed branch because its
 * descendants are not loaded.
 */
export const nodesArrayAndPathsArb = generatedNodesArrayArb.map(
  (generatedNodes) => ({
    entries: generatedNodes.map(({ node }) => node),
    pathEntries: generatedNodes.flatMap(
      ({ reachableNodes }) => reachableNodes,
    ),
  }),
);

/**
 * Generates root-level nodes and a path to one of their reachable nodes.
 *
 * Every generated path is valid for `getAtPath`; unreachable paths are not
 * included.
 */
export const nodesArrayAndPathAndExpectedArb = nodesArrayAndPathsArb
  .filter(({ pathEntries }) => pathEntries.length > 0)
  .chain(({ entries, pathEntries }) =>
    fc.constantFrom(...pathEntries).map(({ path, node }) => ({
      entries,
      path,
      expected: node,
    })),
  );

/**
 * Generates root-level nodes and a path to one of their branch nodes.
 *
 * Both open and closed branches are included. A path to a closed branch is
 * valid, but a path through a closed branch cannot reach any descendants.
 */
export const nodesArrayAndBranchPathArb = nodesArrayAndPathsArb
  .map(({ entries, pathEntries }) => ({
    entries,
    branchPathEntries: pathEntries.filter(
      ({ node }) => 'children' in node,
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
 * Generates a new array of loaded child nodes.
 *
 * The generated nodes have unique IDs, making the result suitable for use as
 * the children of an open branch.
 */
export const newBranchesArb = generatedNodesArrayArb.map(
  (generatedNodes) => generatedNodes.map(({ node }) => node),
);

/**
 * Generates either a new array of loaded child nodes or `null`.
 *
 * An array represents an open branch, including an open branch with no
 * children. `null` represents a closed branch.
 */
export const newBranchesOrNullArb = fc.oneof(
  newBranchesArb,
  fc.constant(null),
);