import {
  createAppApiApplicator,
} from '../domain/app.js';
import type { Init } from '../domain/public-init-api.js';
import type { DirviApi } from '../domain/dirvi-api.js';

/**
 * Creates the runtime application facade from validated initialization data.
 *
 * Registered App values remain private to this module. Consumers interact
 * through app IDs and AppApiApplicator values only.
 */
export function createDirviApi(init: Init): DirviApi {
  const apps = new Map(init.apps.map((app) => [app.id, app]));

  return {
    config: init.config,
    initialAppId: init.initialAppId,
    appIds: [...apps.keys()],

    openApp: (appId, input) => {
      const app = apps.get(appId);

      if (app === undefined) {
        throw new Error(`App "${appId}" is not registered.`);
      }

      return createAppApiApplicator(app, input);
    },
  };
}
