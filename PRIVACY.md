# Privacy Policy

**Nocturne Player collects nothing.**

That is the entire policy. The rest of this document explains how you can check
that claim yourself rather than taking it on trust.

## What is collected

Nothing. No personal data, no usage data, no crash reports, no identifiers, no
analytics, no advertising, no "anonymous statistics".

## What is transmitted

Nothing. The extension has no network access whatsoever.

## What is stored

Your settings — night light intensity, colour adjustments, dim level, subtitle
appearance, playback preferences, and the list of sites you disabled the player
on. These are written with the WebExtension `storage.local` API, which keeps
them **on your device**.

The extension deliberately does **not** use `storage.sync`, because that would
copy your settings through a Mozilla account. Uninstalling the extension removes
everything it stored.

## Permissions

The extension requests two permissions:

| Permission  | Why                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`   | Remember your settings between sessions, on your device.                                                                                                |
| `activeTab` | Let the popup show which site you are on, so you can turn the player off for that site. Granted only while you have the popup open, and never retained. |

The content script additionally matches `<all_urls>`. This is required to notice
a `<video>` element on whatever site you open — a site cannot be inspected for
videos without the ability to run there. The content script reads only the video
element and its subtitle tracks. It does not read page content, form fields,
cookies, or browsing history, and it has no way to send anything anywhere.

You can disable the extension on any individual site from its popup.

## How to verify this

1. **Read the manifest.** `src/manifest.json` is under forty lines and lists
   every permission the extension can ever have.
2. **Run the privacy check.** `npm run lint:privacy` scans the source for
   `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `eval`,
   `storage.sync`, device-sensor APIs, analytics SDK names and remote URLs, and
   fails the build if any appear. It runs in CI on every commit.
3. **Read the shipped code.** The published build is not minified. The file in
   the add-on is readable JavaScript.
4. **Watch the network.** Open `about:debugging`, inspect the extension, and
   look at the Network tab. It stays empty.

## Third parties

There are none. No SDKs, no CDNs, no fonts, no remote resources of any kind. All
dependencies are build-time only and never reach your browser.

## Changes

Any change to this policy will appear in [CHANGELOG.md](CHANGELOG.md) and in the
Git history of this file.

## Contact

Open an issue at
<https://github.com/kvachikk/nocturne-player/issues>.
