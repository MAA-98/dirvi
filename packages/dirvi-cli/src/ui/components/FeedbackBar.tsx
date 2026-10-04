import { Box, Text } from 'ink';

import type { FeedbackDisplay } from './feedback-display.js';

type FeedbackBarProps = {
  display: FeedbackDisplay;
};

export function FeedbackBar({ display }: FeedbackBarProps) {
  if (display.height === 0) {
    return null;
  }

  return (
    <Box width="100%" height={display.height} flexShrink={0}>
      <Text>{display.content}</Text>
    </Box>
  );
}
