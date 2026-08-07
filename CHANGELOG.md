# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased][unreleased]

## [0.3.0][] - 2026-08-07

Everything in this release comes from watching real films on a real phone with
0.2.0 installed.

### Added

- **Quality selection.** The site keeps its ladder; the sheet asks for a rung.
  Adapters for `<source>` lists, YouTube, hls.js, dash.js and Shaka, read
  through the page's own objects — no code is injected into the page and nothing
  is evaluated from a string. Where a player exposes no way in, the row reports
  the resolution being played instead of offering a choice that does nothing.
- **Captions from players that paint their own.** YouTube's caption list is read
  through its player API and the text it renders is mirrored into the player's
  cue layer, which is why subtitles were missing there before. The same mirror
  covers Shaka, video.js, JW Player, Plyr and Playerjs.
- **Picture-in-picture button**, last in the top row after colour and settings,
  where a thumb reaches it. Gecko ships no Web API for it on Android, so the
  button does what a viewer does by hand: it asks Android for the home screen
  and leaves Firefox playing behind it, which is the hand-off Android already
  knows how to float.
- **Chapters on the seek bar.** Where a site publishes sections — YouTube does —
  the bar is cut at each one and the title of the section under the finger is
  named above it.
- **A fullscreen button on the inline video.** One button, drawn as the
  fullscreen arrows, sitting on the site's own small player. It fades out after
  a few seconds untouched and comes back on any tap, so it is there when it is
  wanted and gone when it is not.
- **Fullscreen switch** in the settings sheet. Off runs the player as an overlay
  instead of taking the screen, which leaves Android's ordinary single swipe
  home working.
- Loading an `.srt` / `.vtt` file now actually loads it: the file input had no
  handler, so the button did nothing.

### Changed

- **Pausing is the play button and nothing else.** The invisible pause zone that
  covered the whole picture is gone; a tap anywhere else brings the controls up
  or puts them away.
- **The seek band sits above the bottom of the screen**, clear of the Android
  home swipe, which used to be read as a scrub and threw the film into the
  middle.
- **The badge sits halfway up the right edge** of an inline video rather than in
  the bottom corner, where it covered the site's own controls.
- **The scrim is heavier** where the controls sit, so they stay readable when
  they come up over a bright, playing picture rather than over a paused one.
- Motion follows one easing curve throughout, with scrims and shadows under the
  controls so they stay legible over a bright picture.
- The launcher no longer asks Gecko to hide the navigation UI, which is what put
  Android into sticky immersive mode.

### Fixed

- **The picture stays centred and keeps its shape.** A site that rewrites the
  video's inline style — YouTube does it on every layout pass — could push the
  picture against an edge or stretch it across the screen after a return from
  another app. Position and offsets are pinned along with the size and re-pinned
  whenever the site writes over them, and the zoom is re-derived from what the
  viewer asked for whenever the stage changes shape.
- **Colour starts neutral.** Settings move to schema 2, which drops the four
  colour values once on upgrade: a profile left on zero saturation was playing
  every film in black and white, and one left on 1.3 contrast kept every film
  tinted, neither of them anything a viewer would connect to a setting they
  touched once. Values stored out of range or of the wrong type now fall back
  to the neutral one as well.
- **No more fade to grey while paused.** People pause to look at the picture.
- Leaving the app no longer tears the session down. Losing fullscreen while the
  app is on its way to the background is what Android's floating-window hand-off
  looks like, and it is now told apart from the viewer leaving the player.
- A quality switch that empties the media element no longer backs the player
  out; the check waits to see whether the element really was torn down.
- **YouTube on the phone offers a quality ladder again.** Its player answers
  `getAvailableQualityLevels()` with an empty list there, so the rungs are read
  off the heights of the formats the video itself carries, and the row says
  which of the two ways in produced them.
- The site's player object is captured before the video is moved, so the
  quality, caption and chapter readers still have something to ask once the
  element no longer sits inside it.
- The style guard no longer answers its own writes. It compared what it had
  asked for against what the browser had stored, never matched, and rewrote
  twenty properties on every mutation it caused — which is what made the player
  crawl and fullscreen take seconds to arrive.

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

[unreleased]: https://github.com/kvachikk/nocturne-player/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.3.0
[0.2.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.2.0
