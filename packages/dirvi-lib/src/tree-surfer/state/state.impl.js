export function createStateApi(treeNodeApi, foldNodeApi, cursorApi, navNodeApi) {
    /**
     * Create a new root and fold root.
     *
     * Works on fold root and descendant fold nodes using the generic.
     *
     * TODO: Later: Filter the fold node
     */
    async function reload(oldRoot, oldFoldNode, parentPath, loadBranches) {
        // Do not load a branch that was already closed.
        if (!treeNodeApi.isOpenBranch(oldRoot)) {
            return {
                root: oldRoot,
                foldRoot: oldFoldNode,
            };
        }
        const newChildren = await loadBranches(parentPath);
        let newRoot = {
            ...oldRoot,
            children: newChildren,
        };
        let newFoldNode = oldFoldNode; // Start with assumption of no changes
        for (const oldEntry of oldRoot.children) {
            if (!treeNodeApi.isBranch(oldEntry) ||
                !treeNodeApi.isOpenBranch(oldEntry)) {
                continue;
            }
            const oldChildFoldNode = oldFoldNode === undefined
                ? undefined
                : foldNodeApi.getChildById(oldFoldNode, oldEntry.id);
            const entryPath = [...parentPath, oldEntry.id];
            const reloadedChild = await reload(oldEntry, oldChildFoldNode, entryPath, loadBranches);
            const updatedRoot = treeNodeApi.modifyAtPath(newRoot, [oldEntry.id], (entry) => {
                if (!treeNodeApi.isBranch(entry)) {
                    return undefined;
                }
                return {
                    ...entry,
                    children: reloadedChild.root.children,
                };
            });
            if (updatedRoot !== undefined && treeNodeApi.isOpenBranch(updatedRoot)) {
                newRoot = updatedRoot;
            }
        }
        return {
            root: newRoot,
            foldRoot: newFoldNode,
        };
    }
    /**
     * Currently the cursor just goes to root.
     *
     * TODO: Cursor policy:
     * 1. Keep the exact cursor if it survives,
     * 2. Otherwise, choose the deepest surviving ancestor entry,
     * 3. Otherwise, choose the nearest preceding old cursor that still survives,
     * 4. Otherwise, choose the first new cursor.
     * 5. If no cursor exists, use the root fold cursor.
     */
    function resyncCursor(oldState, newRoot, newFoldNode) {
        return [];
    }
    return {
        getNodeAtCursor(state) {
            const path = cursorApi.getPath(state.cursor);
            return treeNodeApi.getAtPath(state.root, path, (node) => node);
        },
        async resync(oldState, loadChildren) {
            const reloaded = await reload(oldState.root, oldState.foldRoot, [], loadChildren);
            /*
             * `oldState.foldNode` is always present. At the root reload starts with
             * that node, so `reloaded.foldNode` should also always be present.
             *
             * The fallback expresses the State invariant while satisfying the
             * optional return type needed by recursive child reloads.
             */
            const foldRoot = reloaded.foldRoot ?? oldState.foldRoot;
            const cursor = resyncCursor(oldState, reloaded.root, foldRoot) ?? [];
            const root = reloaded.root;
            return {
                ...oldState,
                root,
                foldRoot,
                cursor,
            };
        },
    };
}
