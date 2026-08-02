# Security Policy

## Supported versions

The latest release on addons.mozilla.org.

## Reporting a vulnerability

Use [GitHub private vulnerability
reporting](https://github.com/kvachikk/nocturne-player/security/advisories/new).
Please do not open a public issue for a security problem.

Expect a first reply within a week.

## Scope

The extension runs a content script on every page. Reports of most interest:

- Anything that lets page content execute in the extension's context.
- Anything that leaks page data off the device — the extension has no network
  access by design, so any path to one is a bug.
- Anything that leaves the page modified after the player exits.

`npm audit` findings in build-only dependencies (`web-ext` and its tree) are
out of scope: they never ship to users.
