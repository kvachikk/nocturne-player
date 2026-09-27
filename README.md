[![CI](https://github.com/kvachikk/nocturne-player/actions/workflows/ci.yml/badge.svg)](https://github.com/kvachikk/nocturne-player/actions/workflows/ci.yml)
[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![No data collected](https://img.shields.io/badge/data%20collected-none-brightgreen.svg)](PRIVACY.md)

# Nocturne Player

A touch-first video player for Firefox on Android. No accounts, no telemetry,
no network access.

### Default browser player:

<img width="2856" height="1280" alt="default" src="https://github.com/user-attachments/assets/971f9017-4d59-406a-bff8-cce5e8c96229" />

### Nocturne Player:

<img width="2856" height="1280" alt="better" src="https://github.com/user-attachments/assets/d70cf98b-1fc4-47b4-baf7-918c924103f0" />

Works on any site that plays a plain `<video>`, and on YouTube.

## Features

- **Seek bar** — thick, grab it anywhere; drag away from it to scrub slower.
- **Double-tap** the right side for +10 s, the left for −5 s. Keep tapping to go
  further.
- **Hold** the right side for 2x, the left to rewind.
- **Tap** shows or hides the controls. Only the play button pauses.
- **Pinch** to fill the screen and crop black bars.
- **Swipe** up or down through TikTok / Reels / Shorts feeds.
- **Follows the phone** — portrait or landscape, turning mid-film included.
- **Colour** — brightness, contrast, saturation, and a warm night light.
- **Quality, audio track, speed, subtitles** (site tracks or your own
  `.srt` / `.vtt`).
- **Seasons and episodes** picker, and chapter marks on the seek bar.

## Privacy

- Permissions: `storage` (your settings, on the device) and `activeTab`.
- No `fetch`, no `XMLHttpRequest`, no remote URLs — a CI check enforces it.
- Nothing is collected or sent. Works offline. The build is not minified.
- It runs on all sites only to find the `<video>`; you can turn it off per
  site in the popup.

See [PRIVACY.md](PRIVACY.md).

## Limitations

- **Quality** works with `<source>` lists, YouTube, hls.js, dash.js, Shaka and
  Playerjs. Elsewhere the row shows what is playing.
- **Rewind** is stepped seeking — browsers cannot play backwards.
- **Volume** stays on the phone's buttons; the web has no access to it.
- **Saving a frame** is impossible: Firefox for Android does not let any
  script read a video frame.

## Install

From [addons.mozilla.org](https://addons.mozilla.org). Needs Firefox for
Android 142+ (desktop 140+).

## Development

```bash
npm ci
npm run lint      # eslint, prettier, web-ext lint, privacy check
npm test
npm run build     # dist/
npm run package   # artifacts/nocturne_player-<version>.zip
```

On a phone (enable **Remote debugging via USB** in Firefox's developer
settings first):

```bash
npm run fixture && npm run serve &
adb reverse tcp:8422 tcp:8422
npm run start:android   # then open http://localhost:8422/
```

- Don't run `build:clean` while `web-ext run` is active — it stops the session.
- After a rebuild, reload the page on the phone to get the new content script.

`npm audit` warnings come from `web-ext`, a dev-only dependency; nothing from
`node_modules` ships.

## License

[MPL-2.0](LICENSE)
