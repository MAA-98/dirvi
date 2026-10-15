import { z } from 'zod';
import { defaultTheme, ThemeSchema } from './theme.js';

// =============================================================================
// Configuration
// =============================================================================
export const ConfigSchema = z.object({
  indentSize: z.number().int().min(0).default(2),
  // When omitted, ViewRowComponent uses `indentSize` spaces.
  // An empty string is valid and removes the first indentation prefix.
  firstIndent: z.string().optional(),
  theme: ThemeSchema.default(defaultTheme),
});

export type Config = z.infer<typeof ConfigSchema>;

export const defaultConfig: Config = ConfigSchema.parse({});

// =============================================================================
// Configuration Patch
// =============================================================================
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
 * Deeply merges plain configuration objects without mutating either input.
 *
 * Nested records merge recursively. Scalars, undefined values, and arrays
 * replace the corresponding current value. ConfigSchema validates the result
 * immediately after this operation, since TypeScript cannot prove that a
 * generic runtime merge preserves all domain invariants.
 */
export function merge<Value>(current: Value, patch: DeepPartial<Value>): Value {
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