import { Box, Text } from 'ink';
import type { ViewRow } from '../view.js';
import type { Config } from '../../domain/config.js';
import { colorConfigToInkColor } from '../helpers/color-resolver.js';

type ViewRowComponentProps = {
  row: ViewRow;
  config: Config;
};

function indentationPrefix(
  indent: number,
  indentSize: number,
  firstIndent: string,
  showGuides: boolean,
): string {
  if (indent <= 0 || indentSize <= 0) {
    return '';
  }

  const remainingIndentation = showGuides
    ? `│${' '.repeat(Math.max(0, indentSize - 1))}`
    : ' '.repeat(indentSize);

  return `${firstIndent}${remainingIndentation.repeat(indent - 1)}`;
}

export function ViewRowComponent({ row, config }: ViewRowComponentProps) {
  const leafColor = colorConfigToInkColor(config.theme.tree.leaf.fg);
  const branchColor = colorConfigToInkColor(config.theme.tree.branch.fg);
  const foldedCountColor = colorConfigToInkColor(config.theme.tree.folded.fg);
  const cursorRowBgColor = colorConfigToInkColor(
    config.theme.tree.cursorLine.bg,
  );

  const indentationGuideColor =
    config.theme.tree.indentGuide.fg === undefined
      ? undefined
      : colorConfigToInkColor(config.theme.tree.indentGuide.fg);
  const firstIndent =
    config.firstIndent === undefined
      ? ' '.repeat(config.indentSize)
      : config.firstIndent;
  const indentation = indentationPrefix(
    row.indent,
    config.indentSize,
    firstIndent,
    indentationGuideColor !== undefined,
  );

  switch (row.type) {
    case 'leaf':
      return (
        <Box
          width="100%"
          backgroundColor={row.cursor ? cursorRowBgColor : undefined}
        >
          {indentation !== '' && (
            <Text
              {...(indentationGuideColor === undefined
                ? {}
                : { color: indentationGuideColor, dimColor: true })}
            >
              {indentation}
            </Text>
          )}

          <Text color={leafColor}>{row.content}</Text>
        </Box>
      );

    case 'branch':
      return (
        <Box
          width="100%"
          backgroundColor={row.cursor ? cursorRowBgColor : undefined}
        >
          {indentation !== '' && (
            <Text
              {...(indentationGuideColor === undefined
                ? {}
                : { color: indentationGuideColor, dimColor: true })}
            >
              {indentation}
            </Text>
          )}

          <Text color={branchColor}>{row.content}</Text>

          {row.foldedCount > 0 && (
            <Text color={foldedCountColor} dimColor>
              {` … ${row.foldedCount}`}
            </Text>
          )}
        </Box>
      );
  }
}
