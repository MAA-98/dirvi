import type {} from 'dirvi-apis/dirvi';

dirvi.app.register('xml', {
  source: 'npm',
  packageName: '@mak-98/xml-dirvi-app',
  version: '0.11.0-beta.12',
});

dirvi.app.register('fs', {
  source: 'npm',
  packageName: '@mak-98/posix-fs-dirvi-app',
  version: '0.11.0-beta.12',
});

dirvi.ex.register('path', (api) => {
  const path = api.app.pathAtCursor();
  api.app.addMessage(path.join('/'));
});

dirvi.options.set({
  firstIndent: '',
});
