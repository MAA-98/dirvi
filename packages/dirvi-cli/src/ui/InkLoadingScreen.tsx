import { Text } from 'ink';

import type { LoadingScreenRenderer } from '@mak-98/dirvi-app';

export const InkLoadingScreen: LoadingScreenRenderer = ({}) => {
  return (<Text dimColor>Loading.</Text>);
};