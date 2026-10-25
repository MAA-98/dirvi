import {
  SerializableKey,
  AppApi, createFoldMethods, createCursorMethods, createUnorderedNavMethods, createOrderedNavMethods,
} from 'dirvi-lib';
import {
  createTreeMethods,
  createStateApi,
} from 'dirvi-lib';
import type { AppApiApplicator, AppApiConsumer, AppDefinition, AppDefinitionApplicator } from 'dirvi-apis';

/**
 * Turns a plugin-owned app definition into a host-owned runtime AppApi.
 *
 * The plugin's concrete generic types remain hidden by the applicator
 * boundary, while the host creates the matching AppApi specialization.
 */
export function createAppApiApplicator(
  appDefinitionApplicator: AppDefinitionApplicator,
): AppApiApplicator {
  return appDefinitionApplicator((appDefinition) => {
    const appApi = createAppApi(appDefinition);
    
    return <Result>(
      appApiConsumer: AppApiConsumer<Result>,
    ): Result => appApiConsumer(appApi);
  });
}

export function createAppApi<
  Id extends SerializableKey,
  Value
>(appDefinition: AppDefinition<Id, Value>): AppApi<Id, Value> {
  const treeMethods = createTreeMethods<Id, Value>();
  const foldTreeMethods = createTreeMethods<Id, readonly Id[]>();
  const foldMethods = createFoldMethods(foldTreeMethods);
  const cursorMethods = createCursorMethods<Id>()
  const stateApi = createStateApi<Id, Value>(treeMethods, foldMethods, cursorMethods);
  const navMethods = appDefinition.semanticOrder ?
    createOrderedNavMethods<Id, Value>(
      treeMethods,
      foldMethods,
      cursorMethods) :
    createUnorderedNavMethods(
      treeMethods,
      foldMethods,
      cursorMethods
    );
  
  return {
    name: appDefinition.displayName,
    rootId: appDefinition.rootId,
    createRoot: () => appDefinition.createRoot(treeMethods),
    loadBranches: (path) => appDefinition.loadChildren(treeMethods, path),
    presentNode: (id, isBranch) => appDefinition.presentNode(id, isBranch),
    subscribeToResync: appDefinition.subscribeToResync,
    stateApi,
    navMethods,
  };
}