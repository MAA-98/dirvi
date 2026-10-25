import { useEffect, useMemo } from 'react';
import { Box, Text, useApp, useInput, useWindowSize } from 'ink';

import { ViewRowComponent } from './components/ViewRowComponent.js';
import { FeedbackBar } from './components/FeedbackBar.js';
import { STATUS_BAR_HEIGHT, StatusBar } from './components/StatusBar.js';
import { inkInputToUserInput } from '../infrastructure/ink-input-to-user-input.js';
import { createFeedbackDisplay } from './helpers/feedback-display.js';
import {
  Feedback,
  FeedbackApi,
  FeedbackType,
  InputModeState,
  UserInput,
} from 'dirvi-lib';
import type { AppScreenRenderer, Config } from '@mak-98/dirvi-app';
import { View } from '@mak-98/dirvi-app';

export const InkAppScreen: AppScreenRenderer = ({
  view,
  feedback,
  feedbackApi,
  config,
  inputState,
  handleInput,
  onRowsChange,
  exitStatus,
}: {
  view: View;
  feedback: Feedback | undefined;
  feedbackApi: FeedbackApi;
  config: Config;
  inputState: InputModeState;
  handleInput: (userInput: UserInput) => void;
  onRowsChange: (rows: number) => void;
  exitStatus: string | undefined;
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
  useEffect(() => {
    onRowsChange(terminalRows);
  }, [onRowsChange, terminalRows]);

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
      Math.max(0, terminalRows - STATUS_BAR_HEIGHT),
    );
  }, [feedback, terminalColumns, terminalRows]);

  // ===========================================================================
  // Ink exit hook
  // ===========================================================================
  const { exit } = useApp();

  useEffect(() => {
    if (exitStatus === undefined) {
      return;
    }

    exit();
  }, [exit, exitStatus]);

  if (exitStatus !== undefined) {
    return null;
  }

  return (
    <Box flexDirection="column" height={terminalRows}>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {view.rows.length === 0 ? (
          <Text dimColor>Empty.</Text>
        ) : (
          view.rows.map((row) => (
            <ViewRowComponent key={row.id} row={row} config={config} />
          ))
        )}
      </Box>

      <FeedbackBar
        display={feedbackDisplay}
        type={feedbackType}
        config={config}
      />
      <StatusBar inputState={inputState} config={config} />
    </Box>
  );
};
