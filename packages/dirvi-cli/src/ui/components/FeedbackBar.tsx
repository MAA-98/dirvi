import { Box, Text } from 'ink';

import type { FeedbackType } from 'dirvi-lib';

import type { FeedbackDisplay } from '../helpers/feedback-display.js';

type FeedbackBarProps = {
  display: FeedbackDisplay;
  type: FeedbackType;
};

export function FeedbackBar({ display, type }: FeedbackBarProps) {
  if (display.height === 0) {
    return null;
  }
  
  const color =
    type === 'success' ? 'green' : type === 'error' ? 'red' : 'black';
  
  return (
    <Box width="100%" height={display.height} flexShrink={0}>
      <Text color={color}>{display.content}</Text>
    </Box>
  );
}
