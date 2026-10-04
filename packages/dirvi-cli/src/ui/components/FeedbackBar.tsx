import { Box, Text } from 'ink';

import type { Feedback, FeedbackApi } from 'dirvi-lib';

export const FEEDBACK_BAR_HEIGHT = 1;

type FeedbackBarProps = {
  feedback: Feedback | undefined;
  feedbackApi: FeedbackApi;
};

export function FeedbackBar({ feedback, feedbackApi }: FeedbackBarProps) {
  const message =
    feedback === undefined ? '' : feedbackApi.getMessage(feedback);

  return (
    <Box width="100%" height={FEEDBACK_BAR_HEIGHT} flexShrink={0}>
      <Text wrap="truncate-end">{message}</Text>
    </Box>
  );
}
