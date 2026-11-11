import { useEffect, useMemo } from 'react';
import { Box, Text, useInput, useWindowSize } from 'ink';

import type { Config, FeedbackType, HighlightResolver } from 'dirvi-apis';
import type {
  Feedback,
  FeedbackApi,
  InputModeState,
  UserInput,
} from 'dirvi-lib';
import type { AppScreenRenderer } from '@mak-98/dirvi-app';
import type { View } from '@mak-98/dirvi-app';
import { colorConfigToInkColor } from '@mak-98/dirvi-app';

import { ViewRowsComponent } from './components/ViewRowsComponent.js';
import { FeedbackBar } from './components/FeedbackBar.js';
import { STATUS_BAR_HEIGHT, StatusBar } from './components/StatusBar.js';
import { inkInputToUserInput } from '../infrastructure/ink-input-to-user-input.js';
import { createFeedbackDisplay } from './helpers/feedback-display.js';

export const InkAppScreen: AppScreenRenderer = ({
  view,
  feedback,
  feedbackApi,
  config,
  highlightResolver,
  inputState,
  handleInput,
  onRowsChange,
}: {
  view: View;
  feedback: Feedback | undefined;
  feedbackApi: FeedbackApi;
  config: Config;
  highlightResolver: HighlightResolver;
  inputState: InputModeState;
  handleInput: (userInput: UserInput) => void;
  onRowsChange: (rows: number) => void;
}) => {
  const feedbackType: FeedbackType =
    feedback === undefined ? 'message' : feedbackApi.getType(feedback);

  // ===========================================================================
  // Ink input hook
  // ===========================================================================
  useInput((input, key) => {
    const userInput = inkInputToUserInput(input, key);
    if (userInput === undefined) {
      return;
    }
    handleInput(userInput);
  });

  // ===========================================================================
  // Report back row count
  // ===========================================================================
  const { columns: terminalColumns, rows: terminalRows } = useWindowSize();
  const viewportHeight = Math.max(0, terminalRows - STATUS_BAR_HEIGHT);
  useEffect(() => {
    onRowsChange(viewportHeight);
  }, [onRowsChange, viewportHeight]);

  // ===========================================================================
  // Ink specific display hooks
  // ===========================================================================
  const feedbackDisplay = useMemo(() => {
    if (feedback === undefined) {
      return {
        content: '',
        height: 0,
      };
    }

    return createFeedbackDisplay(
      feedbackApi.getMessage(feedback),
      terminalColumns,
      viewportHeight,
    );
  }, [feedback, terminalColumns, viewportHeight]);

  return (
    <Box flexDirection="column" height={terminalRows}>
      <Box
        position="relative"
        height={viewportHeight}
        width="100%"
        flexShrink={0}
        overflow="hidden"
      >
        <ViewRowsComponent
          view={view}
          config={config}
          highlightResolver={highlightResolver}
        />

        {feedbackDisplay.height > 0 && (
          <Box
            position="absolute"
            top={viewportHeight - feedbackDisplay.height}
            left={0}
            width="100%"
            height={feedbackDisplay.height}
            backgroundColor={colorConfigToInkColor(
              config.theme.feedbackBar[feedbackType].bg,
            )}
          >
            <FeedbackBar
              display={feedbackDisplay}
              type={feedbackType}
              config={config}
            />
          </Box>
        )}
      </Box>

      <StatusBar inputState={inputState} config={config} />
    </Box>
  );
};
