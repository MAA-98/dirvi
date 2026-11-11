import { Box, Text } from 'ink';

import type { Config } from 'dirvi-apis';
import type { ViewRow } from '@mak-98/dirvi-app';
import { colorConfigToInkColor } from '@mak-98/dirvi-app';
import { HighlightStyle } from 'dirvi-apis';

type ViewRowComponentProps = {
  row: ViewRow;
  config: Config;
  resolveHighlight?: (token: string) => HighlightStyle | undefined;
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

export function ViewRowComponent({
  row,
  config,
  resolveHighlight,
}: ViewRowComponentProps) {
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

  function renderSpans(
    fallbackColor: ReturnType<typeof colorConfigToInkColor>,
    dimFallback = false,
  ) {
    return (
      <Text>
        {row.spans.map((span, index) => {
          const style = resolveHighlight?.(span.highlight);

          const color =
            style === undefined
              ? fallbackColor
              : style.fg === undefined
                ? undefined
                : colorConfigToInkColor(style.fg);

          const backgroundColor =
            row.cursor || style?.bg === undefined
              ? undefined
              : colorConfigToInkColor(style.bg);

          return (
            <Text
              key={index}
              {...(color === undefined ? {} : { color })}
              {...(backgroundColor === undefined ? {} : { backgroundColor })}
              {...(style?.bold === undefined ? {} : { bold: style.bold })}
              {...(style?.italic === undefined ? {} : { italic: style.italic })}
              {...(style?.underline === undefined
                ? {}
                : { underline: style.underline })}
              dimColor={style === undefined && dimFallback}
            >
              {span.content}
            </Text>
          );
        })}
      </Text>
    );
  }

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

          {renderSpans(leafColor)}
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

          {renderSpans(branchColor)}

          {row.foldedCount !== undefined && row.foldedCount > 0 && (
            <Text color={foldedCountColor} dimColor>
              {` … ${row.foldedCount}`}
            </Text>
          )}
        </Box>
      );

    case 'fold':
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

          {renderSpans(foldedCountColor, true)}
        </Box>
      );
  }
}
