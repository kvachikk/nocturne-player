# Contributing

Thanks for taking a look.

## Setup

```bash
npm ci
npm run lint && npm test
```

Git hooks are installed automatically: staged files are linted and formatted,
commit messages are checked, and tests run before a push.

## Rules that are not negotiable

This extension makes one promise — it collects nothing and talks to nobody. Any
change that adds a network call, a sensor API, `eval`, `storage.sync`, or a new
manifest permission will fail `npm run lint:privacy` in CI. If you believe a
change genuinely needs one, open an issue first.

Everything else: keep the shipped bundle unminified, and keep new dependencies
out of the extension itself (build-time only).

## Style

`eslint-config-metarhia` plus Prettier, 80 columns. Prefer code that reads
without comments; comment only what the code cannot say.

## Commits

[Conventional Commits](https://www.conventionalcommits.org), lower case, 72
characters max:

```
feat(gestures): add pinch to crop black bars
fix(detect): rank videos by visible area
```

Allowed scopes are listed in `commitlint.config.js`.

## Testing a change

Pure helpers get a unit test in `test/unit/`. Anything touching gestures,
fullscreen, or the DOM has to be checked on a real device — Android behaves
differently from desktop Firefox in ways that matter here.

```bash
npm run fixture && npm run serve &
adb reverse tcp:8422 tcp:8422
npm run start:android
```
