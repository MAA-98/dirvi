import * as fc from 'fast-check';

import type { TreeNode } from './tree-node.types.js';
import { TreeNodeModel } from './tree-node.model.js';

/**
 * The ID and Values types used for the generated test trees.
 *
 * Short strings keep generated counterexamples readable. Values just have to
 * be something easily checked for equality.
 */
type TestNodeId = string;
type TestValue = number;

type TestNode = TreeNode<TestNodeId, TestValue>;
type TestNodeModel = TreeNodeModel<TestNodeId, TestValue>;

type ModelAndPath = {
  path: TestNodeId[];
  model: TestNodeModel;
};

type ModelWithReachableModels = {
  model: TestNodeModel;
  /**
   * Includes this model at `[]` and every descendant reachable through loaded
   * branches. Descendants behind unloaded branches are intentionally absent.
   */
  reachableModels: ModelAndPath[];
};

/**
 * Characters used for readable generated node IDs.
 */
const smallLetterCharacters = Array.from('abcdefghijklmnopqrstuvwxyz');

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
 * Generates serializable application values for test nodes.
 */
export const testValueArb = fc.integer({
  min: -10_000,
  max: 10_000,
});

const generatedLeafModel = (
  id: TestNodeId,
  value: TestValue,
): ModelWithReachableModels => {
  const model: TestNodeModel = {
    id,
    value,
  };

  return {
    model,
    reachableModels: [{ path: [], model }],
  };
};

function generatedUnloadedBranchModel(
  id: TestNodeId,
  value: TestValue,
): ModelWithReachableModels {
  const model: TestNodeModel = {
    id,
    value,
    children: null,
  };

  return {
    model,
    reachableModels: [{ path: [], model }],
  };
}

/**
 * Creates the metadata for a loaded branch and all descendants reachable
 * through its loaded child collection.
 *
 * Child-array order is not semantically meaningful to the tree API. The
 * generator happens to use an array because `TreeNodeModel` is serializable.
 */
function generatedLoadedBranchModel(
  id: TestNodeId,
  value: TestValue,
  children: readonly ModelWithReachableModels[],
): ModelWithReachableModels {
  const model: TestNodeModel = {
    id,
    value,
    children: children.map(({ model: child }) => child),
  };
  
  const reachableDescendants = children.flatMap(
    ({ model: childModel, reachableModels }) =>
      reachableModels.map(({ path, model: reachableModel }) => ({
        path: [childModel.id, ...path],
        model: reachableModel,
      })),
  );
  
  return {
    model,
    reachableModels: [
      { path: [], model },
      ...reachableDescendants,
    ],
  };
}

/**
 * Generates a leaf model.
 */
export const generatedLeafModelArb: fc.Arbitrary<ModelWithReachableModels> =
  fc
    .tuple(testIdArb, testValueArb)
    .map(([id, value]) => generatedLeafModel(id, value));

/**
 * Generates an unloaded-branch model.
 */
export const generatedUnloadedBranchModelArb: fc.Arbitrary<ModelWithReachableModels> =
  fc
    .tuple(testIdArb, testValueArb)
    .map(([id, value]) => generatedUnloadedBranchModel(id, value));

/**
 * Generates either kind of terminal model.
 *
 * Both leaves and unloaded branches terminate path traversal.
 */
const generatedTerminalModelArb: fc.Arbitrary<ModelWithReachableModels> =
  fc.oneof(
    generatedLeafModelArb,
    generatedUnloadedBranchModelArb,
  );

/**
 * Generates a leaf, an unloaded branch, or a loaded branch.
 *
 * Loaded branches have unique child IDs. Root IDs are made unique separately
 * when generating a forest.
 *
 * The weighted choice gives recursive open branches a geometric dropoff.
 */
export const generatedNodeArb: fc.Arbitrary<ModelWithReachableModels> = fc.letrec(
  (tie) => {
    const generatedChildModelArb = tie(
      'node',
    ) as fc.Arbitrary<ModelWithReachableModels>;

    /**
     * Generates the loaded children of an open branch.
     *
     * Sibling IDs must be unique so that child lookup is unambiguous. The
     * maximum length also limits the branching factor of recursive examples.
     */
    const generatedOpenChildrenArb = fc.uniqueArray(generatedChildModelArb, {
      minLength: 0,
      maxLength: 4,
      size: 'medium',
      selector: ({ model }) => model.id,
    });

    /**
     * Generates an open branch and its reachable descendants.
     */
    const generatedLoadedBranchModelArb = fc
      .tuple(testIdArb, testValueArb, generatedOpenChildrenArb)
      .map(([id, value, children]) => generatedLoadedBranchModel(id, value, children));

    return {
      node: fc
        .integer({
          min: 0,
          max: 9999,
        })
        .chain((choice) =>
          // 5046 works for getAtPath tests, but too heavy for modifyAtPath tests
          choice >= 5050
            ? generatedLoadedBranchModelArb
            : generatedTerminalModelArb,
        ),
    };
  },
).node;

/**
 * Generates an array of generated nodes with unique sibling IDs.
 *
 * The result is suitable for use as the loaded children of an open branch.
 */
export const generatedNodesArrayArb = fc.uniqueArray(generatedNodeArb, {
  minLength: 0,
  size: 'small',
  selector: (generated) => generated.model.id,
});

/**
 * An array of root-level nodes and all paths that can be resolved through
 * those nodes.
 *
 * Paths through closed branches stop at the closed branch because its
 * descendants are not loaded.
 */
export const nodeAndPathsArb = generatedNodeArb.map(
  ({ model: root, reachableModels }) => ({
    root,
    pathEntries: reachableModels,
  }),
);

/**
 * Generates root-level nodes and a path to one of their reachable nodes.
 *
 * Every generated path is valid for `getAtPath`; unreachable paths are not
 * included.
 */
export const nodeAndPathAndExpectedArb = nodeAndPathsArb
  .filter(({ pathEntries }) => pathEntries.length > 0)
  .chain(({ root, pathEntries }) =>
    fc.constantFrom(...pathEntries).map(({ path, model }) => ({
      root,
      path,
      expected: model,
    })),
  );

/**
 * Generates root-level nodes and a path to one of their branch nodes.
 *
 * Both open and closed branches are included. A path to a closed branch is
 * valid, but a path through a closed branch cannot reach any descendants.
 */
export const nodesArrayAndBranchPathArb = nodeAndPathsArb
  .map(({ root, pathEntries }) => ({
    root,
    branchPathEntries: pathEntries.filter(({ model }) => 'children' in model),
  }))
  .filter(({ branchPathEntries }) => branchPathEntries.length > 0)
  .chain(({ root, branchPathEntries }) =>
    fc.constantFrom(...branchPathEntries).map(({ path, model }) => ({
      root,
      path,
      expected: model,
    })),
  );

/**
 * Generates a new array of loaded child nodes.
 *
 * The generated nodes have unique IDs, making the result suitable for use as
 * the children of an open branch.
 */
export const newBranchesArb = generatedNodesArrayArb.map((generatedNodes) =>
  generatedNodes.map(({ model }) => model),
);

/**
 * Generates either a new array of loaded child nodes or `null`.
 *
 * An array represents an open branch, including an open branch with no
 * children. `null` represents a closed branch.
 */
export const newBranchesOrNullArb = fc.oneof(newBranchesArb, fc.constant(null));
