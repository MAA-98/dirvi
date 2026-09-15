export type ViewSummary = {
  name: string;
  updatedAt: string;
};

export type ViewApi<State, Key> = {
  save: (key: Key, name: string, state: State) => Promise<void>;
  load: (key: Key, name: string) => Promise<State | undefined>;
  list: (key: Key) => Promise<readonly ViewSummary[]>;
  remove: (key: Key, name: string) => Promise<void>;
};
