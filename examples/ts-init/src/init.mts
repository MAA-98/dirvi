import type {} from 'dirvi-apis/dirvi';

dirvi.app.register({
  id: 'xml',
  create: async (input) => {
    const { xmlApp } = await import('@mak-98/xml-dirvi-app');
    return xmlApp(input);
  },
});

dirvi.app.register({
  id: 'fs',
  create: async (input) => {
    const { posixApp } = await import('@mak-98/posix-fs-dirvi-app');
    return posixApp(input);
  },
  ex: [
    {
      command: 'show-path',
      execute: (api, _rawArg) => {
        const path = api.app.pathAtCursor();
        api.app.addMessage(path.join('/'));
      },
    },
  ],
});

dirvi.options.set({
  firstIndent: ' ',
});
