export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 80],
    'scope-enum': [
      2,
      'always',
      [
        'build',
        'ci',
        'controls',
        'detect',
        'deps',
        'docs',
        'gestures',
        'manifest',
        'popup',
        'privacy',
        'session',
        'subtitles',
        'video',
      ],
    ],
  },
};
