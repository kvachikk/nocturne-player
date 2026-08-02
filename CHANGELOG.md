# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased][unreleased]

## [0.2.0][] - 2026-08-02

First release submitted to addons.mozilla.org.

### Added

- Manifest V2 extension targeting Firefox for Android 142+, declaring
  `data_collection_permissions: { required: ["none"] }` so the absence of data
  collection is machine-checkable rather than merely documented.
- Video detection across frames and shadow roots, ranking candidates by visible
  area so an unloaded player below the fold cannot win over the video on screen.
- Immersive session: re-parents the video into a fullscreen stage, hides the
  site's controls, locks to landscape, and restores the page exactly on exit.
- Seek bar with relative drag: grab it anywhere and the position moves with the
  finger, with precision scaling as the finger moves away from the bar. The
  target time rides the tip of the line while the left label holds the moment
  the drag began.
- Tap anywhere to pause, with a visible play button and −10 / +10 skip buttons
  when the controls are showing.
- Hold either side to scrub at 2x, double-tap to skip ten seconds.
- The picture fills the screen by default; pinch switches between the full
  frame and the cropped one and goes no further.
- Night light, brightness, contrast and saturation, adjusted with plus and
  minus buttons. With every value at its default no filter is applied at all.
- Netflix-style fade to grey while paused, suspended while the colour sheet is
  open so colours can be judged against the real picture.
- Settings sheet with playback speed, subtitles and quality.
- Subtitles from the site's own tracks or a local `.srt` / `.vtt` file, with
  size and sync controls and a fallback to native cue painting. A site's own
  default track is adopted on entry so cues render through the player's layer.
- Preferences persist on the device through `storage.local`. Playback speed is
  deliberately excluded: it belongs to one film, not to the next.
- Build pipeline with esbuild producing an unminified, reproducible bundle;
  linting with eslint-config-metarhia and Prettier; a privacy check that fails
  the build on any network, sensor, analytics or dynamic-code API in the
  source; and CI running all of it on every commit.

### Notes

- Hold-to-scrub steps the clock rather than raising `playbackRate`, which
  Firefox for Android accepts but does not appear to honour during playback.
  There is no sound while scrubbing.
- Volume is left to the phone's own buttons.

[unreleased]: https://github.com/kvachikk/nocturne-player/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.2.0
