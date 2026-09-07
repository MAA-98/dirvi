import {
  createCursorApi,
  createFoldNodeApi,
  createNavNodeApi,
  createTreeNodeApi,
  getCwdAbsPath,
  getDirLazyEntries,
  NameEquals,
  PosixName,
  PosixNode,
} from 'dirvi-lib';
import { join } from 'node:path';
import { AppApi } from '../domain/app-api.js';

export function loadPosixAppProps(): AppApi<PosixName, PosixNode> {
  const cwdAddress = getCwdAbsPath();
  const nameEquals: NameEquals<PosixName> = (first, second) => {
    return first === second;
  };
  const treeNodeApi = createTreeNodeApi<PosixName, PosixNode>(nameEquals);
  const foldNodeApi = createFoldNodeApi<PosixName, PosixNode>(nameEquals);
  const cursorApi = createCursorApi<PosixName>(nameEquals);
  const navNodeApi = createNavNodeApi<PosixName, PosixNode>(
    treeNodeApi,
    foldNodeApi,
    cursorApi,
    nameEquals,
  );

  return {
    name: `Posix(${cwdAddress})`,

    emptyForestMessage: 'The directory is empty.',

    loadBranches: (path) => {
      const address = join(cwdAddress, ...path);
      return getDirLazyEntries(address);
    },

    treeNodeApi,
    foldNodeApi,
    cursorApi,
    navNodeApi,
  };
}
