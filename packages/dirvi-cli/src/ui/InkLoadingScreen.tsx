import { Text } from 'ink';
import { useEffect, useState } from 'react';

import type { LoadingScreenRenderer } from '@mak-98/dirvi-app';

export const InkLoadingScreen: LoadingScreenRenderer = ({}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % 8);
    }, 120);

    return () => clearInterval(timer);
  }, []);
  
  const spinner = ['|', '/', '-', '\\'][frame % 4];

  return (
    <Text>
      <Text color="cyan">{spinner}</Text>
      <Text dimColor> Loading...</Text>
    </Text>
  );
};
