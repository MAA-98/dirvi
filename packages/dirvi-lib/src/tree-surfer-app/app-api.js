import {
  createCursorApi,
  createFoldNodeService,
  createNavNodeApi,
  createStateApi,
  createTreeNodeApi,
} from '../tree-surfer/index.js';
export function createAppApis() {
  const treeNodeApi = createTreeNodeApi();
  const foldNodeApi = createTreeNodeApi();
  const foldNodeService = createFoldNodeService(foldNodeApi);
  const cursorApi = createCursorApi();
  const navNodeApi = createNavNodeApi(treeNodeApi, foldNodeService, cursorApi);
  const stateApi = createStateApi(
    treeNodeApi,
    foldNodeApi,
    cursorApi,
    navNodeApi,
  );
  return {
    treeNodeApi,
    foldNodeApi,
    foldNodeService,
    cursorApi,
    stateApi,
    navNodeApi,
  };
}
