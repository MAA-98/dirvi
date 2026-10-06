import { Box, Text } from 'ink';
import type { ViewRow } from '../view.js';
import type { Config } from '../../domain/config.js';
import { colorConfigToInkColor } from '../helpers/color-resolver.js';

type ViewRowComponentProps = {
  row: ViewRow;
  config: Config;
};

export function ViewRowComponent({ row, config }: ViewRowComponentProps) {
  const leafColor = colorConfigToInkColor(config.theme.tree.leaf.fg);
  const branchColor = colorConfigToInkColor(config.theme.tree.branch.fg);
  const foldedCountColor = colorConfigToInkColor(config.theme.tree.folded.fg);
  const cursorRowBgColor = colorConfigToInkColor(
    config.theme.tree.cursorLine.bg,
  );

  switch (row.type) {
    case 'leaf':
      return (
        <Box
          paddingLeft={row.indent * config.indentSize}
          width="100%"
          backgroundColor={row.cursor ? cursorRowBgColor : undefined}
        >
          <Text color={leafColor}>{row.content}</Text>
        </Box>
      );

    case 'branch':
      return (
        <Box
          paddingLeft={row.indent * config.indentSize}
          width="100%"
          backgroundColor={row.cursor ? cursorRowBgColor : undefined}
        >
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
