import { describe, it } from 'vitest';
import * as fc from 'fast-check';

import { modelWithReachableModelsArb, generatedNodesArrayArb } from './tree-node.arb.js';

/**
 * Manual inspection of generated models and their reachable paths.
 *
 * Remove `.skip` temporarily to run these inspections.
 * These are debugging aids, not assertions about the arbitraries.
 */
describe.skip('inspect tree-node arbitraries', () => {
  const seed = 12345;

  it('prints generated models and reachable paths', () => {
    const samples = fc.sample(modelWithReachableModelsArb, {
      numRuns: 10,
      seed,
    });

    for (const [index, generated] of samples.entries()) {
      console.log(`\n--- model ${index + 1} ---`);

      console.dir(generated.model, {
        depth: Infinity,
        colors: false,
      });

      console.log(
        `reachable nodes: ${generated.reachableModels.length}`,
        `maximum depth: ${Math.max(
          ...generated.reachableModels.map(({ path }) => path.length),
        )}`,
      );

      console.log('reachable paths:');

      console.dir(
        generated.reachableModels.map(({ path, model }) => ({
          path,
          id: model.id,
          kind: !('children' in model)
            ? 'leaf'
            : model.children === null
              ? 'unloaded-branch'
              : 'loaded-branch',
        })),
        {
          depth: Infinity,
          colors: false,
        },
      );
    }
  });

  it('prints generated sibling collections', () => {
    const samples = fc.sample(generatedNodesArrayArb, {
      numRuns: 5,
      seed,
    });

    for (const [index, generatedNodes] of samples.entries()) {
      console.log(`\n--- sibling collection ${index + 1} ---`);

      console.dir(
        generatedNodes.map(({ model }) => model),
        {
          depth: Infinity,
          colors: false,
        },
      );

      console.log(
        'sibling IDs:',
        generatedNodes.map(({ model }) => model.id),
      );

      console.log(
        'total reachable nodes:',
        generatedNodes.reduce(
          (count, generated) => count + generated.reachableModels.length,
          0,
        ),
      );
    }
  });
});
