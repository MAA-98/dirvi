import type {
  SerializableKey,
  AppMethods,
  AppMethodsApplicator,
  AppMethodsConsumer,
} from 'dirvi-lib';
import {
  createFoldMethods, createCursorMethods, createUnorderedNavMethods, createOrderedNavMethods,
} from 'dirvi-lib';
import {
  createTreeMethods,
  createStateApi,
} from 'dirvi-lib';
import type { AppDefinition, AppDefinitionApplicator } from 'dirvi-apis';

/**
 * Turns an app owned `AppDefinition` into a host-owned `AppMethods` service.
 *
 * The plugin's concrete generic types remain hidden by the applicator
 * boundary, while the host creates the matching AppMethods specialization.
 */
export function createAppMethodsApplicator(
  appDefinitionApplicator: AppDefinitionApplicator,
): AppMethodsApplicator {
  return appDefinitionApplicator((appDefinition) => {
    const appMethods = createAppMethods(appDefinition);
    
    return <Result>(
      appMethodsConsumer: AppMethodsConsumer<Result>,
    ): Result => appMethodsConsumer(appMethods);
  });
}

export function createAppMethods<
  Id extends SerializableKey,
  Value
>(appDefinition: AppDefinition<Id, Value>): AppMethods<Id, Value> {
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
  
  async function loadChildren(path: readonly Id[]) {
    const children = await appDefinition.loadChildren(path);
    const seenIds = new Set<Id>();

    return children.map((child) => {
      if (seenIds.has(child.id)) {
        throw new Error('Application returned duplicate sibling IDs');
      }
      seenIds.add(child.id);

      switch (child.kind) {
        case 'leaf':
          return treeMethods.createLeaf(child.id, child.value);

        case 'unloaded-branch':
          return treeMethods.createUnloadedBranch(child.id, child.value);

        default:
          // Also protects against invalid output from JavaScript plugins.
          throw new Error('Application returned an invalid child kind');
      }
    });
  }
  
  return {
    name: appDefinition.displayName,
    loadChildren: (path) => loadChildren(path),
    loadRoot: async () => {
      const rootData = await appDefinition.loadRoot();
      const children = await loadChildren([]);

      const root = treeMethods.createLoadedBranch(
        rootData.id,
        rootData.value,
        children,
      );

      if (root === undefined) {
        throw new Error('Cannot create root: duplicate child IDs');
      }

      return root;
    },
    presentNode: (id, isBranch) => appDefinition.presentNode(id, isBranch),
    subscribeToResync: appDefinition.subscribeToResync,
    stateApi,
    navMethods,
  };
}