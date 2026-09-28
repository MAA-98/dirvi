import { Box, Text } from 'ink';
import { InputModeState } from 'dirvi-lib';

export const STATUS_BAR_HEIGHT = 1;

export type StatusBarConfig = {
  statusBarBgColor: string;
};

type StatusBarProps = {
  inputState: InputModeState;
  config: StatusBarConfig;
};

export function StatusBar({ inputState, config }: StatusBarProps) {
  const inputMode = inputState.inputMode;

  return (
    <Box
      width="100%"
      height={STATUS_BAR_HEIGHT}
      flexDirection="row"
      justifyContent="space-between"
      flexShrink={0}
      backgroundColor={config.statusBarBgColor}
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
