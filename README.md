# Nocturne Player

[![CI](https://github.com/kvachikk/nocturne-player/actions/workflows/ci.yml/badge.svg)](https://github.com/kvachikk/nocturne-player/actions/workflows/ci.yml)
[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![No data collected](https://img.shields.io/badge/data%20collected-none-brightgreen.svg)](PRIVACY.md)

A touch-first video player for **Firefox on Android**. It replaces the built-in
HTML5 controls on ordinary streaming sites with controls that are actually
usable with a thumb while you are watching a film in landscape.

Free software, MPL-2.0. No accounts, no telemetry, no network access at all.

## Why

Firefox for Android's built-in video controls are a thin progress line and a
play button. There is no volume gesture, no zoom to crop black bars, no colour
control, no comfortable way to scrub through a two-hour film. This extension
adds them.

## Scope

Built for **ordinary sites that play video through a plain `<video>` element** —
the kind of site you use to watch a film or a series.

**Not** for YouTube, Vimeo or TikTok. They ship their own player layers, and
overriding those is a fundamentally different (and much larger) problem. This
extension deliberately does not try.

## Features

**Seek bar** — thick, raised off the bottom edge, spanning the full width, with
elapsed time on the left and remaining time on the right. You can grab it
**anywhere**, not just at the current position, and it moves **relative** to
your finger, like the scrubber in Safari on iOS. Moving your finger away from
the bar vertically reduces the scrubbing speed, so you can land on an exact
moment instead of overshooting.

**Volume** — a vertical strip on the right edge, same relative-drag feel.

**Screen dim** — a mirror strip on the left edge that darkens the picture below
100 % for night viewing.

**Tap to pause** — a large invisible zone in the middle of the screen. When
paused, the picture fades to grey, like Netflix.

**Hold for 2x** — hold the right zone to play at double speed, hold the left
zone to rewind. Double-tap either zone for ±10 seconds.

**Pinch to zoom** — crop the black bars away with two fingers; it snaps cleanly
to fit and fill.

**Night Light** — warms the picture to a comfortable amber for watching in the
dark, with adjustable intensity.

**Colour** — brightness, contrast and saturation. Three sliders, nothing more.

**Subtitles** — use the site's own tracks or load an `.srt` / `.vtt` file from
your phone. Adjustable size, background, position, and a sync offset for when
the subtitles drift.

**Lock** — locks all gestures so your palm cannot pause the film. Unlocking
takes two deliberate gestures.

## Privacy

This is the whole story, and you can verify every line of it:

- The extension requests two permissions: `storage`, to remember your settings
  on your device, and `activeTab`, so the popup can tell you which site you are
  on. `activeTab` is granted only for the moment you tap the extension button,
  and Firefox shows no permission warning for it.
- It has **no network access**. Not "we promise not to use it" — there is no
  `fetch`, no `XMLHttpRequest`, no beacon, no remote URL anywhere in the source.
  A CI check (`npm run lint:privacy`) fails the build if any of those appear.
- It never uses `storage.sync`, which would tie your settings to an account.
- Nothing is collected, logged, or sent anywhere. There is nowhere for it to go.
- It works fully offline.
- The published build is **not minified**, so what you read here is what runs.

### Why it asks for access to all sites

The content script matches `<all_urls>` because it has to notice a `<video>`
element on whatever site you happen to open — there is no way to detect videos
on a site without being able to run on that site. It reads nothing else from the
page and sends nothing anywhere. You can disable it per site from the extension
popup.

See [PRIVACY.md](PRIVACY.md).

## Known limitations

These are platform limits, not oversights:

- **Picture-in-Picture does not work on Android.** Firefox for Android has no
  PiP Web API — `requestPictureInPicture()` rejects with `NotSupportedError`
  because the underlying GeckoView support does not exist yet. The button is
  written and feature-detected, so it stays hidden on Android and will appear on
  its own when Gecko ships support.
- **Video quality usually cannot be changed.** Sites that stream over HLS or
  DASH pick the quality in their own JavaScript, and no extension can reach into
  that generically. Where a site offers several `<source>` elements, the quality
  menu switches between them; otherwise it shows the current resolution as
  read-only information.
- **Volume is the video's volume, not the system volume.** The web platform has
  no access to the device volume.
- **Rewind is not "negative 2x".** `playbackRate` cannot go below zero, so
  holding the left zone seeks backwards continuously at roughly 2x instead.
- **Landscape lock is best-effort.** Gecko may refuse the request; the player
  carries on without it.

## Install

From [addons.mozilla.org](https://addons.mozilla.org) once published.

Requires **Firefox for Android 142** or newer (Firefox 140 on desktop). That
floor comes from `data_collection_permissions`, the manifest key that lets the
add-on declare "collects no data" in a form Firefox itself can check.

## Development

```bash
npm ci
npm run lint          # eslint + prettier + web-ext lint + privacy check
npm test              # unit tests for the pure helpers
npm run build         # unminified bundle into dist/
```

Run it on desktop Firefox for fast iteration (use Responsive Design Mode with
touch simulation, and the page in `test/fixtures/local.html`):

```bash
npm start
```

Run it on a connected Android device. First enable **Remote debugging via USB**
in Firefox (Settings → About Firefox → tap the logo five times → Settings →
Developer tools), then:

```bash
npm run fixture                       # generate the test clip and subtitles
npm run serve &                       # serve them on :8422
adb reverse tcp:8422 tcp:8422         # let the phone reach that port
npm run start:android
```

Then open `http://localhost:8422/` on the phone.

Two things worth knowing:

- `web-ext` defaults to an activity name current Firefox builds no longer use.
  The `start:android` script passes `--firefox-apk-component .AppSolidDark`;
  check `adb shell cmd package resolve-activity --brief -c \
android.intent.category.LAUNCHER org.mozilla.firefox` if that ever changes.
- `npm run build` overwrites `dist/` in place rather than recreating it.
  **Do not run `npm run build:clean` while `web-ext run` is active**: deleting
  the directory detaches its watcher, and web-ext then stops Firefox on the
  device and exits. Use `build:clean` for CI and release builds only.
- Re-opening the same URL on the phone only refocuses the tab, leaving the old
  content script in place. Append a changing query (`?r=2`) to force a reload
  after a rebuild.

Debug with `about:debugging` on the desktop, connected to the device over USB.

Build a signable package:

```bash
npm run package       # artifacts/nocturne_player-<version>.zip
```

### A note on `npm audit`

`npm audit` reports advisories in `adm-zip` and `shell-quote`, reached through
Mozilla's own `web-ext` tool. These are **development-only** dependencies; they
are not part of the extension and nothing from `node_modules` is shipped. The
published add-on contains only the files in `dist/`.

## License

[MPL-2.0](LICENSE)
