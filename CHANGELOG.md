# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased][unreleased]

## [0.8.1][] - 2026-09-27

### Fixed

- A tap in the middle shows the controls at once again, so two quick taps
  there pause, as before 0.8.0. Only side taps wait for a second tap.

## [0.8.0][] - 2026-09-27

### Added

- Fullscreen button when the player is not fullscreen; in a small embedded
  frame it replaces exit, colour and settings.

### Fixed

- Turning the phone no longer closes the player. Sites can't take fullscreen
  from it while it's open.
- A slow double-tap no longer shows the controls instead of seeking.
- Holding the left side rewinds visibly instead of freezing.

### Changed

- Hold right = the 2x speed setting, with sound, until you let go.
- Double-tap and hold areas cover the left and right 40% of the screen.
- A single tap on a side shows the controls after ~0.3 s, waiting for a
  second tap.
- Fullscreen opens on the video alone, no controls.
- Settings sheet: narrower, iOS-style sections, segmented controls, switches.
- The site's word for auto quality (e.g. "Авто") shows as "Auto".

## [0.7.0][] - 2026-09-23

### Added

- **Swipe up for the next short video.** With the phone held upright and an
  upright video on screen — TikTok, Reels, Shorts — a swipe up moves on to the
  next video and a swipe down goes back, without leaving the player. The swipe
  scrolls the site's own feed, so the site loads and counts the next video as
  it would for a swipe of its own, and the next video comes up on its own,
  with no controls drawn over it. On a landscape film, or with the phone on
  its side, a vertical swipe does nothing, as before.
- **Double-tap feedback on the side you tapped.** The side lights up as a
  half-moon with arrows running the way the film is going and the seconds the
  run has covered, in place of a label in the middle of the screen.

### Changed

- **The player no longer turns the screen to landscape.** It opens in the
  position the phone is held in and follows it from there. Forcing landscape
  put every upright video on its side the moment the player opened.
- **The picture starts whole instead of filling the screen.** Filling cropped
  the edges off every film that was not the screen's own shape, and cut most
  of an upright video away with the phone on its side. Pinch out to fill the
  screen, as before.
- **Every tap of a double-tap run seeks at once.** From the second tap on, the
  jump happens the moment the finger lifts instead of a quarter of a second
  later, and a tap that lands mid-seek counts from where that seek is going.
- **The colour button is drawn as a painter's palette.** The old outline read
  as a blank shape.

### Removed

- **The subtitle size, subtitle sync and fullscreen rows of the settings
  sheet.** None of them changed the film itself. Subtitles are drawn at their
  default size, and the player always takes the screen.

## [0.6.0][] - 2026-08-16

### Changed

- **The back button skips 5 seconds, not 10.** Going back is for the line of
  dialogue you missed; going forward is for the opening you have seen. Forward
  is unchanged at 10 seconds, and a double-tap in each zone now follows its own
  button: 5 seconds a tap on the left, 10 on the right.

### Removed

- **Picture in picture.** Gecko has no floating-window API on Android, so the
  button asked the system for the home screen and hoped: it worked on some
  builds and did nothing on others. The top row is one button shorter.

### Notes

- **A screenshot button was attempted and is not possible.** Firefox for
  Android does not give a decoded video frame to any script: `drawImage` of the
  video into a 2D canvas leaves it transparent, a WebGL texture of it reads
  back as a single flat colour (`#330033`), and `tabs.captureVisibleTab` draws
  the page with the video area black. This was measured from the page's own
  scripts, from a content script, and from a background script with host
  permissions, on Firefox 153 on an AOSP Android 16 emulator and on a Pixel 9
  Pro. The button is therefore not shipped rather than shipped broken.
## [0.5.0][] - 2026-08-09

### Added

- **Seasons and episodes, as two dropdowns in the corner of the screen.** A
  series on a Playerjs site keeps its path — the season, the dub, the episode —
  and the player draws one control per step of it. Nocturne now reads those and
  puts them where a thumb reaches with the phone held sideways, beside the way
  out: the season on the left, the episode next to it, each opening a list with
  the one you are on marked. Picking an episode plays it without leaving the
  player. A step with only one thing in it — a film with one dub — is not drawn,
  and a page that is a film has no bar at all.
- **Audio tracks.** Film sites often carry two or three dubs and switching them
  from a phone was close to impossible. The sheet now has a row for it, reading
  hls.js `audioTracks`, dash.js `getTracksFor('audio')`, Shaka's audio
  languages, Playerjs's own list and the `audioTracks` a browser exposes on the
  video element. Like the quality row, it stays hidden when there is nothing to
  choose between.

### Changed

- Quality and audio now find the page's player through one shared piece of
  detection rather than each hunting for it separately.

### Notes

- Playerjs answers `api('next')` and `api('prev')`, but refuses an entry by
  index or by name: `api('playlist')` is undefined, `api('play', n)` throws and
  `api('find')` returns false. The dropdowns therefore press the player's own
  rows, which is what its own menu does — reads and presses on elements the page
  already drew, no code injected and nothing evaluated from a string.

## [0.4.0][] - 2026-08-08

### Added

- **Quality on ordinary film sites.** Sites that embed Playerjs — a large part
  of what people actually watch on a phone — now offer their ladder in the
  sheet like any other player. Playerjs keeps its streaming engine inside a
  closure, but it answers about itself: `api('qualities')` lists the rungs the
  site built, in the site's own words, and `api('quality', label)` is the call
  its own menu makes. Both are reads and calls on an object the page already
  published; no code is injected and nothing is evaluated from a string. The
  chips come out auto first, then best to worst, whatever order the site listed
  them in.

### Changed

- The rung the viewer picked is remembered above the adapters rather than
  inside them. The ladder is looked up again every time the sheet opens, which
  builds a fresh adapter, and a player that has been given a rung goes back to
  reporting whatever its own auto has drifted to — so the chip used to fall
  back to Auto a few seconds after a choice. It now stays on the choice until
  the rung stops being offered.

### Notes

- 0.3.0 said a player that keeps its engine in a closure could not be reached
  from an extension at all. That was too strong: Playerjs cannot be reached
  *through its engine*, but it answers questions about itself, and that is
  enough. Players that expose neither still report the resolution being played
  rather than offering a choice that would do nothing.

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
- **Quality leads the settings sheet**, above speed and subtitles. The rows are
  as tall as their chips with a hairline between them, and the sheet ends above
  the seek bar — a nine-rung quality ladder used to wrap across the row beneath
  it and run off the bottom of the screen.
- **Fullscreen switch** in the settings sheet. Off runs the player as an overlay
  instead of taking the screen, which leaves Android's ordinary single swipe
  home working. It applies to the session it is used in and is deliberately not
  remembered, the way playback speed is not.
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
- **Quieter.** Choosing a quality no longer prints a message over the film; the
  chip lighting up says it. Only a refusal is worth a word.
- **Brightness reaches further and moves faster**: 40%–200% in steps of ten,
  rather than 50%–150% in steps of five. A film mastered dark can now actually
  be lifted, and one press does something you can see — at five percent a press
  the control read as one that did nothing.
- Leaving the app no longer tears the session down. Losing fullscreen while the
  app is on its way to the background is what Android's floating-window hand-off
  looks like, and it is now told apart from the viewer leaving the player.
- A quality switch that empties the media element no longer backs the player
  out; the check waits to see whether the element really was torn down.
- **Every call into a site's player was being refused.** `method.apply()`
  reaches the page's own `Function.prototype.apply`, and the page — the less
  privileged side — cannot read the `length` of an array built in the content
  script's compartment, so each call died with "Permission denied to access
  property length" before it arrived. Calls go through `Reflect.apply` now.
  This one bug is why quality, captions and chapters were all missing on
  YouTube; all three work.
- **A drag along the seek bar no longer throws the viewer back to the page.**
  YouTube removes its `<video>` element when it is told a seek is final, and a
  drag was telling it so every 120ms. Seeks go through the site's own `seekTo`
  where there is one, and only the finger coming off counts as final. The watch
  that decides a video has been torn down is slower and harder to convince too.
- **The fullscreen button takes the screen.** It used to obey a stored switch
  that a stray tap could turn off for good, after which the button looked
  broken. The switch in the sheet still drops back to the overlay, for the
  session it is used in.
- The site's player object is captured before the video is moved, so the
  quality, caption and chapter readers still have something to ask once the
  element no longer sits inside it.
- The style guard no longer answers its own writes. It compared what it had
  asked for against what the browser had stored, never matched, and rewrote
  twenty properties on every mutation it caused — which is what made the player
  crawl and fullscreen take seconds to arrive.

### Notes

- Quality on a site that embeds Playerjs — common on film sites — is still the
  site's to choose. The page publishes the hls.js constructor and a player
  object with one opaque method; the instance that holds the ladder never
  leaves the closure. Driving the player's own menu is the way in, and it is
  left for a later version.

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

[unreleased]: https://github.com/kvachikk/nocturne-player/compare/v0.8.1...HEAD
[0.8.1]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.8.1
[0.8.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.8.0
[0.7.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.7.0
[0.6.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.6.0
[0.5.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.5.0
[0.4.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.4.0
[0.3.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.3.0
[0.2.0]: https://github.com/kvachikk/nocturne-player/releases/tag/v0.2.0
