import { Box, Text } from 'ink';

import type { FeedbackType } from 'dirvi-lib';

import type { FeedbackDisplay } from '../helpers/feedback-display.js';
import type { Config } from '../../domain/config.js';
import { colorConfigToInkColor } from '../helpers/color-resolver.js';

type FeedbackBarProps = {
  display: FeedbackDisplay;
  type: FeedbackType;
  config: Config;
};

export function FeedbackBar({ display, type, config }: FeedbackBarProps) {
  if (display.height === 0) {
    return null;
  }

  const highlight =
    type === 'success'
      ? config.theme.feedbackBar.success
      : type === 'error'
        ? config.theme.feedbackBar.error
        : config.theme.feedbackBar.message;

  const color = colorConfigToInkColor(highlight.fg);
  const backgroundColor = colorConfigToInkColor(highlight.bg);

  return (
    <Box
      width="100%"
      height={display.height}
      flexShrink={0}
      backgroundColor={backgroundColor}
    >
      <Text color={color}>{display.content}</Text>
    </Box>
  );
}
