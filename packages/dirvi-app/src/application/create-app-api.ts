import type {
  SerializableKey,
  AppApi
} from 'dirvi-lib';
import {
  createCursorApi,
  createFoldsApi,
  createNavNodeApi,
  createStateApi,
  createTreeNodeApi
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
  const treeNodeApi = createTreeNodeApi<Id, Value>();
  const foldTreeNodeApi = createTreeNodeApi<Id, readonly Id[]>();
  const foldsApi = createFoldsApi(foldTreeNodeApi);
  const cursorApi = createCursorApi<Id>()
  const stateApi = createStateApi<Id, Value>(treeNodeApi, cursorApi);
  const navNodeApi = createNavNodeApi<Id, Value>(
    treeNodeApi,
    foldsApi,
    cursorApi,
    appDefinition.createNavNodeApiOptions
  )
  
  return {
    name: appDefinition.displayName,
    rootId: appDefinition.rootId,
    createRoot: () => appDefinition.createRoot(treeNodeApi),
    loadBranches: (path) => appDefinition.loadChildren(treeNodeApi, path),
    presentNode: (id, isBranch) => appDefinition.presentNode(id, isBranch),
    subscribeToResync: appDefinition.subscribeToResync,
    treeNodeApi,
    foldsApi,
    cursorApi,
    stateApi,
    navNodeApi,
  };
}