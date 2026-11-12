import type { HighlightResolver } from 'dirvi-apis';

export const highlightResolver: HighlightResolver = (token: string) => {
  switch (token) {
    case 'icon.typescript': {
      return {
        fg: {
          hex: '#3178C6',
        },
      };
    }
    case 'icon.javascript': {
      return {
        fg: {
          hex: '#F1DD35',
        },
      };
    }
    case 'icon.folder': {
      return {
        fg: {
          hex: '#7ecdfa',
        },
      };
    }
    case 'foldername': {
      return {
        fg: {
          hex: '#e1e1e1',
        },
      };
    }
  }
};
