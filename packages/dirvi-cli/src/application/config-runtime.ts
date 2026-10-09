import type { Config } from '../domain/config.js';
import { ConfigSchema, defaultConfig } from '../domain/config.js';

/**
 * A recursively optional form of a configuration value.
 *
 * Config scripts submit patches rather than full Config values, so a script can
 * change a nested option without repeating unrelated defaults. Arrays remain
 * whole values because configuration arrays should be replaced, not merged by
 * index.
 */
type DeepPartial<Value> = Value extends readonly unknown[]
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]?: DeepPartial<Value[Key]> }
    : Value;

/**
 * A partial configuration update accepted from an init.mjs script.
 *
 * Every patch is merged with the current complete configuration and then
 * validated with ConfigSchema before it becomes active.
 */
export type ConfigPatch = DeepPartial<Config>;

/**
 * The startup configuration API exposed to init.mjs as globalThis.dirvi.
 *
 * This is intentionally a narrow facade. It is the public scripting boundary,
 * rather than an escape hatch into UI state or infrastructure implementations.
 */
export type DirviConfigApi = {
  readonly options: {
    set: (patch: ConfigPatch) => void;
  };
};

/**
 * Collects startup configuration registrations while init.mjs is evaluated.
 *
 * The application exposes `api` to the script, then calls `finish()` once
 * evaluation completes to seal registration and obtain the validated Config.
 */
export type ConfigRuntime = {
  readonly api: DirviConfigApi;
  readonly finish: () => Config;
};

/**
 * Creates a fresh startup configuration session.
 *
 * Each runtime owns its own mutable configuration while registration is open.
 * The mutable state is not exposed directly to the config script.
 */
export function createConfigRuntime(): ConfigRuntime {
  let config = defaultConfig;
  let finished = false;

  return {
    api: {
      options: {
        set: (patch) => {
          // init.mjs is a startup script. It must not modify startup options
          // after the host has finished evaluating and consuming it.
          if (finished) {
            throw new Error(
              'Configuration registration is closed. Configure dirvi while init.mjs is being evaluated.',
            );
          }

          // Validate the complete result, not merely the patch. This preserves
          // domain invariants even when a patch changes nested configuration.
          config = ConfigSchema.parse(merge(config, patch));
        },
      },
    },

    finish: () => {
      finished = true;
      return config;
    },
  };
}

/**
 * Deeply merges plain configuration objects without mutating either input.
 *
 * Nested records merge recursively. Scalars, undefined values, and arrays
 * replace the corresponding current value. ConfigSchema validates the result
 * immediately after this operation, since TypeScript cannot prove that a
 * generic runtime merge preserves all domain invariants.
 */
function merge<Value>(current: Value, patch: DeepPartial<Value>): Value {
  if (!isRecord(current) || !isRecord(patch)) {
    return patch as Value;
  }

  const result: Record<string, unknown> = { ...current };

  for (const [key, patchValue] of Object.entries(patch)) {
    const currentValue = result[key];

    result[key] =
      isRecord(currentValue) && isRecord(patchValue)
        ? merge(currentValue, patchValue)
        : patchValue;
  }

  return result as Value;
}

/**
 * Returns whether a value can participate in the object-merge branch.
 *
 * Arrays are deliberately excluded: they are configuration values to replace
 * atomically rather than collections to merge by numeric index.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
