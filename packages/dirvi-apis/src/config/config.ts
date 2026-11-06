import { Theme } from './theme.js';

export type Config = {
  indentSize: number;
  // When omitted, `indentSize` spaces is used:
  firstIndent?: string | undefined;
  theme: Theme;
};

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
 * validated before it becomes active.
 */
export type ConfigPatch = DeepPartial<Config>;
