import type { HighlightResolver } from 'dirvi-apis';

export const highlightResolver: HighlightResolver = (token: string) => {
  switch (token) {
    case 'icon.typescript': {
      return {
        fg: {
          hex: '#3178c6',
        },
      };
    }
    case 'icon.javascript': {
      return {
        fg: {
          hex: '#f1dd35',
        },
      };
    }

    case 'icon.json': {
      return {
        fg: {
          hex: '#ae8be6',
        },
      };
    }

    case 'icon.git': {
      return {
        fg: {
          hex: '#dd4d3a',
        },
      };
    }

    case 'icon.svg': {
      return {
        fg: {
          hex: '#ebad51',
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
    case 'content': {
      return {
        fg: {
          hex: '#e1e1e1',
        },
      };
    }
  }
};
