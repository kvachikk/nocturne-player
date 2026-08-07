# Notes for add-on reviewers

The submitted package is built from this source with esbuild. Nothing is
minified, obfuscated, or fetched at build time, so the bundle in the package
reads the same as the files here.

## Build environment

- Node.js 26.3.1 (any Node >= 20 produces the same output)
- npm 10.5.0
- Fedora Linux, x86_64 — the build has no platform-specific steps

## Steps to reproduce the submitted package

```sh
npm ci                  # installs only devDependencies; the add-on ships none
npm run build:clean     # esbuild -> dist/, unminified, no sourcemaps
npx web-ext build -s dist -a artifacts --overwrite-dest
```

The result is `artifacts/nocturne_player-0.3.0.zip`. Its contents match the
submitted file; only the zip's own timestamps differ between runs.

## What the build does

`esbuild.config.mjs` bundles two entry points — the content script and the
popup — with `minify: false`, `format: 'iife'`, and `bundle: true`, then copies
`src/manifest.json`, the icons, and the popup's HTML and CSS into `dist/`. The
player's own CSS is bundled into the content script as text (esbuild's `text`
loader) so it can be attached to a closed shadow root. There is no code
generation, no template step, and no download.

## Checks you can run

```sh
npm run lint          # eslint + prettier + web-ext lint + the privacy check
npm test              # unit tests
npm run lint:privacy  # fails on any network, sensor, analytics or eval-like API
```

`tools/check-privacy.mjs` is the one worth a look: it fails the build if the
source contains `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`,
`EventSource`, `importScripts`, `eval(`, `new Function(`, `storage.sync`,
`navigator.geolocation`, `navigator.mediaDevices`, `document.cookie`, any
analytics identifier, or any `http(s)://` URL other than links to github.com and the W3C SVG
namespace identifier.
It also asserts that the manifest requests exactly `storage` and `activeTab`
and declares no host permissions.

## Notes on the page interaction

The content script reads the site's own player object through Firefox's
`wrappedJSObject` waiver in order to ask it for quality levels, caption tracks
and chapter lists (`src/content/video/pageapi.js` is the only place this
happens, and every read is guarded). It never assigns code into the page, never
evaluates a string, and passes objects into the page compartment only through
`cloneInto`.
