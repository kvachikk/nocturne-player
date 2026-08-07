# Listing copy for addons.mozilla.org

Ready to paste into the AMO submission form. Everything here is checkable
against the source; nothing claims a capability the build does not have.

## Summary (250 characters)

Touch-first video controls for Firefox on Android: seek from anywhere with a
thumb, pick the quality the site hid, read subtitles the site paints itself,
and warm the picture down for a dark room. No network access at all.

## What it does that the built-in controls do not

These are the reasons to install it. Each one is a thing Firefox for Android,
or the site's own mobile player, does not give you.

- **Seek from anywhere on the screen, at the precision you choose.** Put a
  thumb anywhere in the lower band and drag: the film moves with it. Pull the
  thumb away from the bar and the same swipe covers less time — 1x on the bar,
  down to a tenth of that at the top of the band — so a two-hour film can be
  landed on the exact scene without pinching or a stylus. The left label holds
  the moment the drag began, so you can always find your way back.
- **The quality the mobile site will not offer you.** YouTube's mobile web
  player publishes no quality menu at all; the sheet reads the ladder out of
  the player and lets you pin a rung. The same row covers `<source>` lists,
  hls.js, dash.js and Shaka, so it is not a YouTube trick.
- **Chapters on the seek bar, on a site that does not draw them there.** Where
  a video publishes sections, the bar is cut at each one and the section under
  the finger is named above it. YouTube's mobile site does not show them.
- **Subtitles from players that paint their own.** A player like YouTube's
  draws captions itself, outside the browser's text-track machinery, so
  nothing can restyle or shift them. They are mirrored into the player's own
  cue layer, where they get a size control and a **sync offset** — the fix for
  subtitles that run half a second ahead, which the web platform gives you no
  way to correct.
- **Load an `.srt` or `.vtt` from the phone** onto a video that has no
  subtitles of its own.
- **Night light, brightness, contrast and saturation, live on the film.**
  A warm layer for watching in the dark, and a picture that can be lifted when
  a film is mastered too dark for a phone screen. With every value left alone,
  no filter is applied at all — the film is passed through exactly as encoded.
- **Fill the screen, without stretching.** The letterbox is cropped away by
  default; a pinch moves between the whole frame and the cropped one and goes
  no further, and a pan can never expose an edge. The crop is re-derived
  whenever the screen changes shape, so it survives a rotation, a return from
  another app, and a quality switch.
- **Hold either side to scrub at 2x**, double-tap to skip ten seconds, and a
  play button that is the only place a tap pauses — so no misfires while
  reaching across the picture.
- **It leaves the Android home swipe alone.** The player does not put the
  system into sticky immersive mode, so one swipe still leaves the app, and the
  seek band sits clear of the gesture strip at the bottom of the screen.
- **It works on any site with a `<video>`**, not a list of supported ones.

## Privacy, stated plainly

- **No network access whatsoever.** There is no `fetch`, no `XMLHttpRequest`,
  no beacon, no WebSocket and no remote URL anywhere in the source. A check in
  the build (`npm run lint:privacy`) fails on any of them, so this is enforced
  rather than promised.
- **Two permissions**: `storage`, to keep your settings on the device, and
  `activeTab`, so the popup can name the site you are on. No host permissions.
- **Nothing is collected, logged or transmitted.** `data_collection_permissions`
  is declared as `{ required: ["none"] }`, which makes the absence
  machine-checkable rather than a claim in a paragraph.
- Settings never use `storage.sync`, so they are not tied to an account.
- **The published build is not minified.** What you read in the source is what
  runs on the phone.
- It works fully offline.

## Why it needs to run on all sites

The content script matches `<all_urls>` because it has to notice a `<video>`
element on whatever site you open — there is no way to detect a video on a site
without being allowed to run there. It reads nothing else from the page and
sends nothing anywhere, and it can be switched off per site from the popup.

## Known limits, said up front

- There is no Web API for picture-in-picture on Firefox for Android. The button
  asks Android for the home screen and leaves the film playing behind it, which
  is the hand-off the system already knows how to float — whether it floats is
  Android's decision, not the extension's.
- Quality depends on what the site's player exposes. A player that keeps its
  engine in a closure cannot be reached from an extension; the sheet then
  reports the resolution being played rather than offering a choice that would
  do nothing.
- Volume is left to the phone's own buttons: the web platform has no access to
  the system volume.
- Hold-to-scrub steps the clock rather than raising `playbackRate`, which
  Firefox for Android accepts but does not appear to honour. There is no sound
  while scrubbing.

## Notes for reviewers

See [REVIEWERS.md](REVIEWERS.md) — build environment, the exact commands that
reproduce the submitted package, and what the privacy check enforces.
