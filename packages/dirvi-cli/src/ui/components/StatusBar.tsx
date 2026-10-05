import { Box, Text } from 'ink';
import type { Config } from '../../domain/config.js';

import type { InputModeState } from 'dirvi-lib';
import { colorConfigToInkColor } from '../helpers/color-resolver.js';

export const STATUS_BAR_HEIGHT = 1;

type StatusBarProps = {
  inputState: InputModeState;
  config: Config;
};

export function StatusBar({ inputState, config }: StatusBarProps) {
  const inputMode = inputState.inputMode;
  const statusBarBgColor = colorConfigToInkColor(config.statusBarBgColor);

  return (
    <Box
      width="100%"
      height={STATUS_BAR_HEIGHT}
      flexDirection="row"
      justifyContent="space-between"
      flexShrink={0}
      backgroundColor={statusBarBgColor}
    >
      <Box flexShrink={1}>
        <Text color="black" wrap="truncate-end">
          {inputMode === 'command' ? inputState.commandLine : ''}
        </Text>
      </Box>

      <Box flexShrink={1}>
        <Text color="black" wrap="truncate-start">
          {inputMode === 'normal' ? inputState.normalBuffer : ''}
        </Text>
      </Box>
    </Box>
  );
}
