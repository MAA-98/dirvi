import { Box, Text } from 'ink';

import type { Config, HighlightResolver } from 'dirvi-apis';
import type { View } from '@mak-98/dirvi-app';

import { ViewRowComponent } from './ViewRowComponent.js';

type ViewRowsComponentProps = {
  view: View;
  config: Config;
  highlightResolver: HighlightResolver;
};

export function ViewRowsComponent({
  view,
  config,
  highlightResolver,
}: ViewRowsComponentProps) {
  return (
    <Box flexDirection="column" flexShrink={0} width="100%">
      {view.rows.length === 0 ? (
        <Text dimColor>Empty.</Text>
      ) : (
        view.rows.map((row, index) => (
          // TODO: Use a stable row ID when ViewRow exposes one.
          <ViewRowComponent
            key={index}
            row={row}
            config={config}
            highlightResolver={highlightResolver}
          />
        ))
      )}
    </Box>
  );
}
