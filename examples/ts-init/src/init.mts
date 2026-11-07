import type {} from 'dirvi-apis/dirvi';

dirvi.app.register({
  id: 'xml',
  packRef: {
    source: 'npm',
    packageName: '@mak-98/xml-dirvi-app',
    version: '0.11.0-beta.13',
  },
  ex: [
    {
      command: 'show-path',
      execute: (api, args) => {
        const path = api.app.pathAtCursor();
        api.app.addMessage(path.join('/'));
      }
    }
  ]
});

dirvi.app.register('fs', {
  source: 'npm',
  packageName: '@mak-98/posix-fs-dirvi-app',
  version: '0.11.0-beta.13',
});

dirvi.options.set({
  firstIndent: ' ',
});
