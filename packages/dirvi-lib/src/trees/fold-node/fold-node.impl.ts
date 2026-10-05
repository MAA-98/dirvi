import type {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from '../tree-node/index.js';
import type {
  FoldNodeModel,
  FoldsModel,
  FoldSlotModel,
} from './fold-node.model.js';
import type {
  FoldIndex,
  FoldInfo,
  Folds,
  FoldsApi,
} from './fold-node.types.js';

/**
 * IDs of direct source-tree entries hidden at one source-tree branch.
 */
type HiddenEntryIds<Id extends SerializableKey> = readonly Id[];

/**
 * Private runtime representation of one fold tree.
 *
 * The representation remains private: callers receive only opaque `Folds`
 * values and interact with them through `FoldsApi`.
 */
type FoldTree<Id extends SerializableKey> = TreeNode<Id, HiddenEntryIds<Id>>;

type FoldSlot<Id extends SerializableKey> = Readonly<{
  name: string;
  description: string | null;
  active: boolean;
  tree: FoldTree<Id>;
}>;

type FoldSlots<Id extends SerializableKey> = readonly [
  FoldSlot<Id>,
  ...(FoldSlot<Id> | undefined)[],
];

type FoldsData<Id extends SerializableKey> = Readonly<{
  slots: FoldSlots<Id>;
}>;

function toData<Id extends SerializableKey>(folds: Folds<Id>): FoldsData<Id> {
  return folds as unknown as FoldsData<Id>;
}

function fromData<Id extends SerializableKey>(data: FoldsData<Id>): Folds<Id> {
  return data as unknown as Folds<Id>;
}

function isValidFoldIndex(index: FoldIndex): boolean {
  return Number.isSafeInteger(index) && index >= 0;
}

function hasUniqueValues<Value>(values: readonly Value[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Creates operations for an immutable collection of independently active fold
 * trees.
 *
 * Each fold tree preserves its own hidden-entry definition. An entry is hidden
 * by the aggregate when at least one active fold tree hides it.
 */
export function createFoldsApi<Id extends SerializableKey>(
  foldTreeApi: TreeNodeApi<Id, HiddenEntryIds<Id>>,
): FoldsApi<Id> {
  function createEmptyFoldTree(rootId: Id): FoldTree<Id> {
    const tree = foldTreeApi.createLoadedBranch(rootId, [], []);

    /*
     * An empty child collection cannot contain duplicate IDs. Failure would
     * therefore indicate a broken TreeNodeApi implementation or contract.
     */
    if (tree === undefined) {
      throw new Error('Could not create an empty fold tree');
    }

    return tree;
  }

  function getSlotAtIndex(
    folds: Folds<Id>,
    index: FoldIndex,
  ): FoldSlot<Id> | undefined {
    if (!isValidFoldIndex(index)) {
      return undefined;
    }

    return toData(folds).slots[index];
  }

  function withSlotAtIndex(
    folds: Folds<Id>,
    index: FoldIndex,
    foldData: FoldSlot<Id>,
  ): Folds<Id> {
    if (!isValidFoldIndex(index)) {
      throw new RangeError('Fold index must be a non-negative safe integer');
    }

    const data = toData(folds);
    const slots = [...data.slots];

    while (slots.length <= index) {
      slots.push(undefined);
    }

    slots[index] = foldData;

    /*
     * `setAtIndex` permits replacing the primary slot. Other public operations
     * preserve the invariant that slot zero is always occupied.
     */
    return fromData({
      slots: slots as unknown as FoldSlots<Id>,
    });
  }

  function updateSlotAtIndex(
    folds: Folds<Id>,
    index: FoldIndex,
    update: (foldData: FoldSlot<Id>) => FoldSlot<Id>,
  ): Folds<Id> | undefined {
    const foldData = getSlotAtIndex(folds, index);

    if (foldData === undefined) {
      return undefined;
    }

    const updatedFoldData = update(foldData);

    if (updatedFoldData === foldData) {
      return folds;
    }

    return withSlotAtIndex(folds, index, updatedFoldData);
  }

  function removeSlotAtIndex(folds: Folds<Id>, index: FoldIndex): Folds<Id> {
    const data = toData(folds);
    const slots = [...data.slots];

    slots[index] = undefined;

    /*
     * Trailing unoccupied slots carry no information, so omit them from the
     * immutable runtime representation.
     */
    while (slots.length > 1 && slots[slots.length - 1] === undefined) {
      slots.pop();
    }

    return fromData({
      slots: slots as unknown as FoldSlots<Id>,
    });
  }

  function getLoadedChildren(tree: FoldTree<Id>): FoldTree<Id>[] | undefined {
    const children = foldTreeApi.getLoadedChildren(tree);

    return children === undefined ? undefined : [...children];
  }

  function createEmptyFoldNode(id: Id): FoldTree<Id> {
    const tree = foldTreeApi.createLoadedBranch(id, [], []);

    if (tree === undefined) {
      throw new Error('Could not create an empty fold node');
    }

    return tree;
  }

  /**
   * Creates structural fold-tree nodes for `path` where they do not already
   * exist. A fold tree structurally retains descendants even when an entry is
   * hidden at its parent, so paths may pass through hidden entry IDs.
   */
  function ensurePath(
    tree: FoldTree<Id>,
    path: readonly Id[],
  ): FoldTree<Id> | undefined {
    if (path.length === 0) {
      return tree;
    }

    const children = getLoadedChildren(tree);

    if (children === undefined) {
      return undefined;
    }

    const childId = path[0];

    if (childId === undefined) {
      return undefined;
    }

    const childIndex = children.findIndex(
      (child) => foldTreeApi.id(child) === childId,
    );

    const child =
      childIndex === -1 ? createEmptyFoldNode(childId) : children[childIndex];

    if (child === undefined) {
      return undefined;
    }

    const updatedChild = ensurePath(child, path.slice(1));

    if (updatedChild === undefined) {
      return undefined;
    }

    if (childIndex === -1) {
      return foldTreeApi.withLoadedChildren(tree, [...children, updatedChild]);
    }

    if (updatedChild === child) {
      return tree;
    }

    const updatedChildren = [...children];
    updatedChildren[childIndex] = updatedChild;

    return foldTreeApi.withLoadedChildren(tree, updatedChildren);
  }

  function isEmptyFoldNode(tree: FoldTree<Id>): boolean | undefined {
    const children = getLoadedChildren(tree);

    if (children === undefined) {
      return undefined;
    }

    return foldTreeApi.value(tree).length === 0 && children.length === 0;
  }

  /**
   * Updates one existing fold-tree node and prunes empty sparse descendants on
   * the path back to the root.
   *
   * The root is always retained, even if it becomes empty.
   */
  function updateAtPathAndPrune(
    tree: FoldTree<Id>,
    path: readonly Id[],
    update: (node: FoldTree<Id>) => FoldTree<Id>,
  ): FoldTree<Id> | undefined {
    if (path.length === 0) {
      return update(tree);
    }

    const children = getLoadedChildren(tree);

    if (children === undefined) {
      return undefined;
    }

    const childId = path[0];

    if (childId === undefined) {
      return undefined;
    }

    const childIndex = children.findIndex(
      (child) => foldTreeApi.id(child) === childId,
    );

    if (childIndex === -1) {
      return undefined;
    }

    const child = children[childIndex];

    if (child === undefined) {
      return undefined;
    }

    const updatedChild = updateAtPathAndPrune(child, path.slice(1), update);

    if (updatedChild === undefined) {
      return undefined;
    }

    if (updatedChild === child) {
      return tree;
    }

    const childIsEmpty = isEmptyFoldNode(updatedChild);

    if (childIsEmpty === undefined) {
      return undefined;
    }

    const updatedChildren = [...children];

    if (childIsEmpty) {
      updatedChildren.splice(childIndex, 1);
    } else {
      updatedChildren[childIndex] = updatedChild;
    }

    return foldTreeApi.withLoadedChildren(tree, updatedChildren);
  }

  function foldTreeToModel(tree: FoldTree<Id>): FoldNodeModel<Id> {
    return foldTreeApi.match<FoldNodeModel<Id>>(tree, {
      leaf: () => {
        throw new Error('Fold trees must contain loaded branch nodes');
      },

      unloadedBranch: () => {
        throw new Error('Fold trees must contain loaded branch nodes');
      },

      loadedBranch: ({ id, value, children }) => ({
        id,
        hiddenEntryIds: [...value],
        children: [...children].map(foldTreeToModel),
      }),
    });
  }

  function foldSlotToModel(foldData: FoldSlot<Id>): FoldSlotModel<Id> {
    return {
      name: foldData.name,
      description: foldData.description,
      active: foldData.active,
      tree: foldTreeToModel(foldData.tree),
    };
  }

  function foldTreeFromModel(
    model: FoldNodeModel<Id>,
  ): FoldTree<Id> | undefined {
    if (!hasUniqueValues(model.hiddenEntryIds)) {
      return undefined;
    }

    const children: FoldTree<Id>[] = [];

    for (const childModel of model.children) {
      const child = foldTreeFromModel(childModel);

      if (child === undefined) {
        return undefined;
      }

      children.push(child);
    }

    return foldTreeApi.createLoadedBranch(
      model.id,
      [...model.hiddenEntryIds],
      children,
    );
  }

  const api: FoldsApi<Id> = {
    create(rootId, initialPrimaryInfo) {
      return fromData({
        slots: [
          {
            name: initialPrimaryInfo.name,
            description: initialPrimaryInfo.description,
            active: true,
            tree: createEmptyFoldTree(rootId),
          },
        ],
      });
    },

    getIndexByName(folds, name) {
      const { slots } = toData(folds);
      let matchingIndex: FoldIndex | undefined;

      for (let index = 0; index < slots.length; index += 1) {
        const foldData = slots[index];

        if (foldData === undefined || foldData.name !== name) {
          continue;
        }

        /*
         * Names are intended to be durable user-facing references. Until
         * creation, rename, and restoration enforce unique names, do not
         * choose an arbitrary matching fold tree.
         */
        if (matchingIndex !== undefined) {
          return undefined;
        }

        matchingIndex = index;
      }

      return matchingIndex;
    },

    getInfoAtIndex(folds, index) {
      const foldData = getSlotAtIndex(folds, index);

      if (foldData === undefined) {
        return undefined;
      }

      return {
        name: foldData.name,
        description: foldData.description,
      };
    },

    isActiveAtIndex(folds, index) {
      return getSlotAtIndex(folds, index)?.active;
    },

    hasAtIndex(folds, index) {
      return getSlotAtIndex(folds, index) !== undefined;
    },

    *indexes(folds) {
      const { slots } = toData(folds);

      for (let index = 0; index < slots.length; index += 1) {
        if (slots[index] !== undefined) {
          yield index;
        }
      }
    },

    // TODO: Enforce unique names
    setAtIndex(folds, index, foldData) {
      if (!isValidFoldIndex(index)) {
        return undefined;
      }

      const tree = foldTreeFromModel(foldData.tree);

      if (tree === undefined) {
        return undefined;
      }

      return withSlotAtIndex(folds, index, {
        name: foldData.name,
        description: foldData.description,
        active: foldData.active,
        tree,
      });
    },

    setAdditionalFoldAtIndex(folds, index, rootId, info) {
      if (!isValidFoldIndex(index) || index === 0) {
        return undefined;
      }

      return withSlotAtIndex(folds, index, {
        name: info.name,
        description: info.description,
        active: true,
        tree: createEmptyFoldTree(rootId),
      });
    },

    removeAdditionalFoldAtIndex(folds, index) {
      if (!isValidFoldIndex(index) || index === 0) {
        return undefined;
      }

      if (getSlotAtIndex(folds, index) === undefined) {
        return folds;
      }

      return removeSlotAtIndex(folds, index);
    },

    updateInfoAtIndex(folds, index, update) {
      return updateSlotAtIndex(folds, index, (foldData) => {
        const name = update.name ?? foldData.name;
        const description =
          update.description === undefined
            ? foldData.description
            : update.description;

        if (name === foldData.name && description === foldData.description) {
          return foldData;
        }

        return {
          ...foldData,
          name,
          description,
        };
      });
    },

    activateAtIndex(folds, index) {
      return updateSlotAtIndex(folds, index, (foldData) =>
        foldData.active ? foldData : { ...foldData, active: true },
      );
    },

    deactivateAtIndex(folds, index) {
      return updateSlotAtIndex(folds, index, (foldData) =>
        !foldData.active ? foldData : { ...foldData, active: false },
      );
    },

    toggleActiveAtIndex(folds, index) {
      return updateSlotAtIndex(folds, index, (foldData) => ({
        ...foldData,
        active: !foldData.active,
      }));
    },

    isEntryHiddenInFoldAtPath(folds, index, path, entryId) {
      const foldData = getSlotAtIndex(folds, index);

      if (foldData === undefined) {
        return false;
      }

      return (
        foldTreeApi.selectAtPath(foldData.tree, path, (node) =>
          foldTreeApi.value(node).includes(entryId),
        ) ?? false
      );
    },

    isEntryHiddenAtPath(folds, path, entryId) {
      for (const index of api.indexes(folds)) {
        if (
          api.isActiveAtIndex(folds, index) === true &&
          api.isEntryHiddenInFoldAtPath(folds, index, path, entryId)
        ) {
          return true;
        }
      }

      return false;
    },

    hiddenEntryIdsAtPath(folds, index, path) {
      const foldData = getSlotAtIndex(folds, index);

      if (foldData === undefined) {
        return undefined;
      }

      return foldTreeApi.selectAtPath(foldData.tree, path, (node) => [
        ...foldTreeApi.value(node),
      ]);
    },

    hideEntryAtPath(folds, index, path, entryId) {
      const foldData = getSlotAtIndex(folds, index);

      if (foldData === undefined) {
        return undefined;
      }

      if (api.isEntryHiddenInFoldAtPath(folds, index, path, entryId)) {
        return folds;
      }

      const treeWithPath = ensurePath(foldData.tree, path);

      if (treeWithPath === undefined) {
        return undefined;
      }

      const updatedTree = updateAtPathAndPrune(treeWithPath, path, (node) =>
        foldTreeApi.withValue(node, [...foldTreeApi.value(node), entryId]),
      );

      if (updatedTree === undefined) {
        return undefined;
      }

      return withSlotAtIndex(folds, index, {
        ...foldData,
        tree: updatedTree,
      });
    },

    showEntryAtPath(folds, index, path, entryId) {
      const foldData = getSlotAtIndex(folds, index);

      if (foldData === undefined) {
        return undefined;
      }

      const updatedTree = updateAtPathAndPrune(foldData.tree, path, (node) => {
        const hiddenEntryIds = foldTreeApi.value(node);

        if (!hiddenEntryIds.includes(entryId)) {
          return node;
        }

        return foldTreeApi.withValue(
          node,
          hiddenEntryIds.filter((id) => id !== entryId),
        );
      });

      if (updatedTree === undefined) {
        return undefined;
      }

      if (updatedTree === foldData.tree) {
        return folds;
      }

      return withSlotAtIndex(folds, index, {
        ...foldData,
        tree: updatedTree,
      });
    },

    showAllHiddenEntriesAtPath(folds, index, path) {
      const foldData = getSlotAtIndex(folds, index);

      if (foldData === undefined) {
        return undefined;
      }

      const updatedTree = updateAtPathAndPrune(foldData.tree, path, (node) => {
        if (foldTreeApi.value(node).length === 0) {
          return node;
        }

        return foldTreeApi.withValue(node, []);
      });

      if (updatedTree === undefined) {
        return undefined;
      }

      if (updatedTree === foldData.tree) {
        return folds;
      }

      return withSlotAtIndex(folds, index, {
        ...foldData,
        tree: updatedTree,
      });
    },

    toModel(folds) {
      const { slots } = toData(folds);

      const modelSlots: FoldsModel<Id>['slots'] = [
        foldSlotToModel(slots[0]),
        ...slots
          .slice(1)
          .map((foldData) =>
            foldData === undefined ? null : foldSlotToModel(foldData),
          ),
      ];

      return {
        slots: modelSlots,
      };
    },

    fromModel(model) {
      const slots: (FoldSlot<Id> | undefined)[] = [];

      for (const foldSlotModel of model.slots) {
        if (foldSlotModel === null) {
          slots.push(undefined);
          continue;
        }

        const tree = foldTreeFromModel(foldSlotModel.tree);

        if (tree === undefined) {
          return undefined;
        }

        slots.push({
          name: foldSlotModel.name,
          description: foldSlotModel.description,
          active: foldSlotModel.active,
          tree,
        });
      }

      const primarySlot = slots[0];

      if (primarySlot === undefined) {
        return undefined;
      }

      const foldSlots: FoldSlots<Id> = [primarySlot, ...slots.slice(1)];

      return fromData({
        slots: foldSlots,
      });
    },
  };

  return api;
}
