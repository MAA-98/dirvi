import * as fc from 'fast-check';

import { TreeNodeModel } from './tree-node.model.js';

/**
 * The ID and Values types used for the generated test trees.
 *
 * Short strings keep generated counterexamples readable. Values just have to
 * be something easily checked for equality.
 */
type Id = string;
type Value = number;

type ModelAndPath = {
  model: TreeNodeModel<Id, Value>;
  path: Id[];
};

/**
 * A model and a pair of a model and its path for every reachable path in the
 * model
 *
 * Includes this model at `[]` and every descendant reachable through loaded
 * branches. Descendants behind unloaded branches are intentionally absent.
 */
type ModelWithReachableModels = {
  model: TreeNodeModel<Id, Value>;
  reachableModels: ModelAndPath[];
};

// =============================================================================
// ID and Value Arbitraries
// =============================================================================

/**
 * Characters used for readable generated node IDs.
 */
const smallLetterCharacters = Array.from('abcdefghijklmnopqrstuvwxyz');

/**
 * Generates valid string IDs for test nodes. Note that the API just does
 * comparisons on the IDs so we can safely restrict to any subset.
 */
export const idArb = fc.string({
  unit: fc.constantFrom(...smallLetterCharacters),
  minLength: 1,
  maxLength: 8,
});

/**
 * Generates serializable application values for test nodes.
 */
export const valueArb = fc.integer({
  min: -10_000,
  max: 10_000,
});

// =============================================================================
// Generating Models with Reachable Models
// =============================================================================

// Helpers

const createLeafModel = (
  id: Id,
  value: Value,
): ModelWithReachableModels => {
  const model: TreeNodeModel<Id, Value> = {
    id,
    value,
  };

  return {
    model,
    reachableModels: [{ path: [], model }],
  };
};

function createUnloadedBranchModel(
  id: Id,
  value: Value,
): ModelWithReachableModels {
  const model: TreeNodeModel<Id, Value> = {
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
 * Child-array order is preserved, both in the model and in the enumeration
 * of reachable descendants.
 */
function createLoadedBranchModel(
  id: Id,
  value: Value,
  children: readonly ModelWithReachableModels[],
): ModelWithReachableModels {
  const model: TreeNodeModel<Id, Value> = {
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
    reachableModels: [{ path: [], model }, ...reachableDescendants],
  };
}

// Arbs

/**
 * Generates a leaf model.
 */
export const leafModelWRMArb: fc.Arbitrary<ModelWithReachableModels> = fc
  .tuple(idArb, valueArb)
  .map(([id, value]) => createLeafModel(id, value));

/**
 * Generates an unloaded-branch model.
 */
export const unloadedBranchModelWRMArb: fc.Arbitrary<ModelWithReachableModels> =
  fc
    .tuple(idArb, valueArb)
    .map(([id, value]) => createUnloadedBranchModel(id, value));

/**
 * Generates either kind of 'terminal' model.
 *
 * Both leaves and unloaded branches terminate path traversal.
 */
const terminalModelWRMArb: fc.Arbitrary<ModelWithReachableModels> =
  fc.oneof(leafModelWRMArb, unloadedBranchModelWRMArb);

/**
 * Generates a leaf, an unloaded branch, or a loaded branch.
 *
 * Loaded branches have unique child IDs. Root IDs are made unique separately
 * when generating a forest.
 *
 * The weighted choice gives recursive loaded branches a geometric drop off.
 */
export const modelWithReachableModelsArb: fc.Arbitrary<ModelWithReachableModels> =
  fc.letrec((tie) => {
    const generatedChildModelArb = tie(
      'node',
    ) as fc.Arbitrary<ModelWithReachableModels>;

    /**
     * Generates the loaded children of a loaded branch.
     *
     * Sibling IDs must be unique so that child lookup is unambiguous. The
     * maximum length also limits the branching factor of recursive examples.
     */
    const generatedLoadedChildrenArb = fc.uniqueArray(generatedChildModelArb, {
      minLength: 0,
      maxLength: 4,
      size: 'medium',
      selector: ({ model }) => model.id,
    });

    /**
     * Generates a loaded branch and its reachable descendants.
     */
    const generatedLoadedBranchModelArb = fc
      .tuple(idArb, valueArb, generatedLoadedChildrenArb)
      .map(([id, value, children]) =>
        createLoadedBranchModel(id, value, children),
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
            ? generatedLoadedBranchModelArb
            : terminalModelWRMArb,
        ),
    };
  }).node;

// =============================================================================
// Generating Models
// =============================================================================
// Prepares inputs for particular tests.

// Generating Replacement Child State

/**
 * Generates an array of generated models with unique sibling IDs.
 *
 * The result is suitable for use as the loaded children of a loaded branch.
 */
export const siblingModelsWRMArb = fc.uniqueArray(modelWithReachableModelsArb, {
  minLength: 0,
  size: 'small',
  selector: (generated) => generated.model.id,
});

// Generating Models with a Selected Reachable Target

/**
 * Generates root-level models and a path to one of their reachable models.
 *
 * Every generated path is valid for `getAtPath`; unreachable paths are not
 * included.
 */
export const modelAndReachablePathArb = modelWithReachableModelsArb.chain(
  ({ model: root, reachableModels }) =>
    fc.constantFrom(...reachableModels).map(({ path, model }) => ({
      root,
      path,
      expected: model,
    })),
);

/**
 * Generates a root model and a path to one of its reachable branch models.
 *
 * Both loaded and unloaded branches are included.
 */
export const modelAndBranchPathArb = modelWithReachableModelsArb
  .map(({ model: root, reachableModels }) => ({
    root,
    branchPathEntries: reachableModels.filter(
      ({ model }) => 'children' in model,
    ),
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
 * Generates a new array of loaded child models.
 *
 * The generated models have unique IDs, making the result suitable for use as
 * the children of a loaded branch.
 */
export const childrenModelsArb = siblingModelsWRMArb.map((generatedNodes) =>
  generatedNodes.map(({ model }) => model),
);

/**
 * Generates either a new array of loaded child models or `null`.
 *
 * An array represents a loaded branch, including a loaded branch with no
 * children. `null` represents an unloaded branch.
 */
export const childrenStateModelArb = fc.oneof(childrenModelsArb, fc.constant(null));
