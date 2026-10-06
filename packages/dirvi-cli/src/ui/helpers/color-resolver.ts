import type { ColorConfig } from '../../domain/theme.js';

type RgbColor = [number, number, number];

const ansi16Colors: readonly RgbColor[] = [
  [0, 0, 0],
  [205, 49, 49],
  [13, 188, 121],
  [229, 229, 16],
  [36, 114, 200],
  [188, 63, 188],
  [17, 168, 205],
  [229, 229, 229],
  [102, 102, 102],
  [241, 76, 76],
  [35, 209, 139],
  [245, 245, 67],
  [59, 142, 234],
  [214, 112, 214],
  [41, 184, 219],
  [255, 255, 255],
];

export function colorConfigToInkColor(
  colorConfig: ColorConfig,
  colorDepth: number = process.stderr.getColorDepth(),
): string {
  const { hex, ansi256, basic } = colorConfig;

  if (colorDepth >= 24 && hex !== undefined) {
    return hex;
  }

  if (colorDepth >= 8 && ansi256 !== undefined) {
    return toHex(ansi256ToRgb(ansi256));
  }

  if (basic !== undefined) {
    return basic;
  }

  // A more specific value was not configured. Let Ink/Chalk reduce the
  // available richer value for the current terminal where necessary.
  if (ansi256 !== undefined) {
    return toHex(ansi256ToRgb(ansi256));
  }

  if (hex !== undefined) {
    return hex;
  }

  // ColorConfigSchema guarantees at least one profile is configured.
  throw new Error('Expected at least one terminal color profile');
}

function ansi256ToRgb(color: number): RgbColor {
  if (color < 16) {
    return ansi16Colors[color]!;
  }

  if (color >= 232) {
    const component = 8 + (color - 232) * 10;

    return [component, component, component];
  }

  const cubeColor = color - 16;
  const red = Math.floor(cubeColor / 36);
  const green = Math.floor((cubeColor % 36) / 6);
  const blue = cubeColor % 6;
  const components = [0, 95, 135, 175, 215, 255];

  return [components[red]!, components[green]!, components[blue]!];
}

function toHex([red, green, blue]: RgbColor): string {
  return `#${toHexComponent(red)}${toHexComponent(green)}${toHexComponent(
    blue,
  )}`;
}

function toHexComponent(component: number): string {
  return component.toString(16).padStart(2, '0');
}
