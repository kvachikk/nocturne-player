import configMetarhia from 'eslint-config-metarhia';
import globals from 'globals';

const [baseConfig] = configMetarhia;

export default [
  {
    ignores: ['dist/*', 'artifacts/*', 'node_modules/*'],
  },
  {
    ...baseConfig,
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ...baseConfig.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        // Firefox gives content scripts these for talking to the page's own
        // compartment; they are not part of the standard browser globals.
        cloneInto: 'readonly',
        exportFunction: 'readonly',
      },
    },
  },
  {
    files: ['esbuild.config.mjs', 'tools/**/*.mjs', 'test/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
