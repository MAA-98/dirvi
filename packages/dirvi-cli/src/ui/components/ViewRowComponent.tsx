import { Box, Text } from 'ink';
import { ViewRow } from '../view.js';

export function ViewRowComponent({ row }: { row: ViewRow }) {
  const prefix = '';

  switch (row.type) {
    case 'leaf':
      return (
        <Box paddingLeft={row.indent * 2}>
          <Text inverse={row.selected}>
            {prefix}
            {row.content}
          </Text>
        </Box>
      );

    case 'branch':
      return (
        <Box paddingLeft={row.indent * 2}>
          <Text inverse={row.selected} color="blue">
            {prefix}
            {row.content}
          </Text>
        </Box>
      );

    case 'fold':
      return (
        <Box paddingLeft={row.indent * 2}>
          <Text inverse={row.selected} dimColor>
            {prefix}
            {row.content}
          </Text>
        </Box>
      );
  }
}
