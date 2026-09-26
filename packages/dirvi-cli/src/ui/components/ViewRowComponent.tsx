import { Box, Text } from 'ink';
import { ViewRow } from '../view.js';

export function ViewRowComponent({ row }: { row: ViewRow }) {
  switch (row.type) {
    case 'leaf':
      return (
        <Box paddingLeft={row.indent * 2}>
          <Text inverse={row.cursor}>{row.content}</Text>
        </Box>
      );

    case 'branch':
      return (
        <Box paddingLeft={row.indent * 2}>
          <Text inverse={row.cursor} color="blue">
            {row.content}
          </Text>

          {row.foldedCount > 0 && (
            <Text color="gray" dimColor>
              {` … ${row.foldedCount} folded`}
            </Text>
          )}
        </Box>
      );
  }
}
