# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased][unreleased]

### Added

- Project scaffold: Manifest V2 extension targeting Firefox for Android 142+.
- Declared `data_collection_permissions: { required: ["none"] }` so the absence
  of data collection is machine-checkable, not just documented.
- Video detection across frames and shadow roots, ranking candidates by visible
  area so an unloaded player below the fold cannot win over the video on screen.
- Immersive session: re-parents the video into a fullscreen stage, hides the
  site's controls, locks to landscape, and restores the page exactly on exit.
- Gesture recognizer over bounded touch zones with dead space between them:
  tap to pause, double-tap the side boxes to skip, hold them for 2x forward and
  2x rewind, pinch reserved for zoom.
- Seek bar with relative drag: grab it anywhere and the position moves with the
  finger, with precision scaling as the finger moves away from the bar.
- Volume and screen-dim strips on the right and left edges.
- Pinch to zoom, snapping to fit and to the scale that crops the black bars.
- Night light, and brightness, contrast and saturation adjusted with plus and
  minus buttons rather than sliders.
- Netflix-style fade to grey while paused.
- Lock mode: a tap reveals the pill, a swipe across it unlocks.
- Settings sheet with playback speed, subtitles and quality.
- Subtitles from the site's own tracks or a local `.srt` / `.vtt` file, with a
  size and sync control and a fallback to native cue painting.
- Preferences persist on the device through `storage.local`.
- Build pipeline with esbuild producing an unminified bundle.
- Linting with eslint-config-metarhia and Prettier.
- Privacy check that fails the build on any network, sensor, analytics or
  dynamic-code API appearing in the source.
- Continuous integration running lint, unit tests, build and `web-ext lint`.

[unreleased]: https://github.com/kvachikk/nocturne-player/commits/main
