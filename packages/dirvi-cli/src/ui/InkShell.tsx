import { useCallback, useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { useApp } from 'ink';

import { Shell } from '@mak-98/dirvi-app';

type InkShellProps = Omit<ComponentProps<typeof Shell>, 'onQuit'>;

export function InkShell(props: InkShellProps) {
  const { exit } = useApp();
  const [exiting, setExiting] = useState(false);

  const onQuit = useCallback(() => {
    setExiting(true);
  }, []);

  useEffect(() => {
    if (exiting) {
      exit();
    }
  }, [exit, exiting]);

  if (exiting) {
    return null;
  }

  return <Shell {...props} onQuit={onQuit} />;
}
