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

## Key features

### Skip intro

The player learns a series' opening by ear and offers to skip it — no
internet, no database of shows, nothing to set up.

- **Episode 1** — it listens.
- **Episode 2** — it hears the stretch that sounds the same as the episode
  before, and paints it on the seek bar as it plays.
- **From episode 3** — **Skip intro** comes up a second into the opening,
  wherever the opening falls, and lands where the story starts.

A new opening mid-season is learned the same way. Only a coarse spectrum of
the sound is kept, on the device, with no address or title, and the listening
can be switched off in the settings sheet.

### Colour

The palette button tunes the picture: **brightness**, **contrast**,
**saturation**, and a warm **night light** for watching in the dark. The
choice is remembered for the next film.

## Everything else

- **Seek bar** — thick, grab it anywhere; drag away from it to scrub slower.
- **Double-tap** the right side for +10 s, the left for −10 s. Keep tapping to
  go further.
- **Hold** the right side for 2x, the left to rewind.
- **Tap** shows or hides the controls. Only the play button pauses.
- **Pinch** to fill the screen and crop black bars.
- **Swipe** up or down through TikTok / Reels / Shorts feeds.
- **Follows the phone** — portrait or landscape, turning mid-film included.
- **Quality, audio track, speed, subtitles** (site tracks or your own
  `.srt` / `.vtt`) in the settings sheet.
- **Seasons and episodes** picker, and chapter marks on the seek bar.

## Privacy

- Permissions: `storage` (your settings, on the device) and `activeTab`.
- No `fetch`, no `XMLHttpRequest`, no remote URLs — a CI check enforces it.
- Nothing is collected or sent. Works offline. The build is not minified.
- Skip intro keeps coarse spectra of what it heard, on the device, with no
  address or title; no sound can be rebuilt from them.
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
- **Skip intro** needs two episodes to learn an opening and offers to skip it
  from the third. It listens only to a video the site serves itself (most
  players, YouTube included); a film loaded from another domain is left
  alone, since the browser would silence it.

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
