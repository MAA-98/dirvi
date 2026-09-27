export function createNavNodeApi(treeNodeApi, foldNodeService, cursorApi) {
    function entryIsBranch(entry) {
        return 'children' in entry;
    }
    function createNavNode(entries, foldRoot, parentPath) {
        const visibleEntries = [];
        const foldedEntries = [];
        const foldedEntryIds = foldRoot === undefined
            ? undefined
            : foldNodeService.foldedEntriesAtPath(foldRoot, parentPath);
        for (const entry of entries) {
            const entryPath = [...parentPath, entry.id];
            const isFolded = foldRoot !== undefined &&
                foldNodeService.getIfEntryFoldedAtPath(foldRoot, parentPath, entry.id);
            const navigationEntry = createNavEntry(entry, foldRoot, entryPath);
            if (isFolded) {
                foldedEntries.push(navigationEntry);
            }
            else {
                visibleEntries.push(navigationEntry);
            }
        }
        return {
            entries: visibleEntries,
            folded: foldedEntryIds === undefined || foldedEntryIds.length === 0
                ? null
                : {
                    entries: foldedEntries,
                },
        };
    }
    function createNavEntry(entry, foldRoot, entryPath) {
        if (treeNodeApi.isLeaf(entry)) {
            return {
                id: entry.id,
            };
        }
        return createNavBranch(entry, foldRoot, entryPath);
    }
    function createNavBranch(entry, foldRoot, entryPath) {
        if (!treeNodeApi.isBranch(entry)) {
            throw new Error('Navigation root must be a branch');
        }
        return {
            id: entry.id,
            children: entry.children === null
                ? null
                : createNavNode(entry.children, foldRoot, entryPath),
        };
    }
    function rootCursors(rootNode) {
        if (rootNode.children === null) {
            return [[]];
        }
        return [[], ...cursorsInNode(rootNode.children, [])];
    }
    function cursorsInNode(node, parentPath) {
        const cursors = [];
        for (const entry of node.entries) {
            const entryPath = [...parentPath, entry.id];
            cursors.push(entryPath);
            if (!entryIsBranch(entry) || entry.children === null) {
                continue;
            }
            cursors.push(...cursorsInNode(entry.children, entryPath));
        }
        return cursors;
    }
    const navNodeApi = {
        entryIsBranch,
        // Return a nav node from the TreeNode and FoldNode trees.
        from(root, foldRoot) {
            return createNavBranch(root, foldRoot, []);
        },
        getNodeAtPath(navigation, path) {
            const [currentId, ...remainingPath] = path;
            // An empty path identifies the current node.
            if (currentId === undefined) {
                return navigation;
            }
            const entry = navigation.entries.find((candidate) => candidate.id === currentId);
            if (entry === undefined) {
                return undefined;
            }
            if (!entryIsBranch(entry)) {
                return undefined;
            }
            // The directory has not been loaded/opened.
            if (entry.children === null) {
                return undefined;
            }
            return navNodeApi.getNodeAtPath(entry.children, remainingPath);
        },
        getEntryAtPath(navigation, path) {
            const [currentId, ...remainingPath] = path;
            if (currentId === undefined) {
                return undefined;
            }
            const entry = navigation.entries.find((candidate) => candidate.id === currentId);
            if (entry === undefined) {
                return undefined;
            }
            if (remainingPath.length === 0) {
                return entry;
            }
            if (!entryIsBranch(entry) || entry.children === null) {
                return undefined;
            }
            return navNodeApi.getEntryAtPath(entry.children, remainingPath);
        },
        nextCursor(rootNode, cursor) {
            const cursors = rootCursors(rootNode);
            const currentIndex = cursors.findIndex((candidate) => cursorApi.equal(candidate, cursor));
            if (currentIndex === -1 || currentIndex === cursors.length - 1) {
                return undefined;
            }
            return cursors[currentIndex + 1];
        },
        previousCursor(rootNode, cursor) {
            const cursors = rootCursors(rootNode);
            const currentIndex = cursors.findIndex((candidate) => cursorApi.equal(candidate, cursor));
            if (currentIndex <= 0) {
                return undefined;
            }
            return cursors[currentIndex - 1];
        },
        cursorAfterFold(rootNode, cursor) {
            if (cursor.length === 0) {
                return undefined;
            }
            const cursors = rootCursors(rootNode);
            const currentIndex = cursors.findIndex((candidate) => cursorApi.equal(candidate, cursor));
            if (currentIndex === -1) {
                return undefined;
            }
            for (let index = currentIndex + 1; index < cursors.length; index += 1) {
                const candidate = cursors[index];
                if (candidate === undefined) {
                    continue;
                }
                if (cursorApi.cursorBelongsToSubtree(candidate, cursor)) {
                    continue;
                }
                return candidate;
            }
            // The fold row will be created at the end of this directory.
            return [...cursor];
        },
        parentCursor(_navigation, cursor) {
            if (cursor.length === 0) {
                return undefined;
            }
            return cursor.slice(0, -1);
        },
        cursors(navigation, parentPath = []) {
            return cursorsInNode(navigation, parentPath);
        },
        visibleLeavesPaths(navigation, parentPath = []) {
            const paths = [];
            for (const entry of navigation.entries) {
                const entryPath = [...parentPath, entry.id];
                if (entryIsBranch(entry)) {
                    // A null children value means that the directory has not been
                    // loaded/opened, so there are no visible descendant files.
                    if (entry.children !== null) {
                        paths.push(...navNodeApi.visibleLeavesPaths(entry.children, entryPath));
                    }
                    continue;
                }
                paths.push(entryPath);
            }
            return paths;
        },
    };
    return navNodeApi;
}
