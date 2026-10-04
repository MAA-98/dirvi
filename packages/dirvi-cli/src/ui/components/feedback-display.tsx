import sliceAnsi from 'slice-ansi';
import wrapAnsi from 'wrap-ansi';

export type FeedbackDisplay = {
  content: string;
  height: number;
};

export function createFeedbackDisplay(
  message: string,
  terminalColumns: number,
  maximumHeight: number,
): FeedbackDisplay {
  if (maximumHeight <= 0) {
    return {
      content: '',
      height: 0,
    };
  }

  const columns = Math.max(1, terminalColumns);
  const lines = wrapAnsi(message, columns, {
    hard: true,
    trim: false,
    wordWrap: true,
  }).split('\n');

  if (lines.length <= maximumHeight) {
    return {
      content: lines.join('\n'),
      height: lines.length,
    };
  }

  const visibleLines = lines.slice(0, maximumHeight);
  const lastLineIndex = visibleLines.length - 1;

  visibleLines[lastLineIndex] = truncateWithEllipsis(
    visibleLines[lastLineIndex]!,
    columns,
  );

  return {
    content: visibleLines.join('\n'),
    height: visibleLines.length,
  };
}

function truncateWithEllipsis(line: string, columns: number): string {
  if (columns < 3) {
    return '.'.repeat(columns);
  }

  return `${sliceAnsi(line, 0, columns - 3)}...`;
}
