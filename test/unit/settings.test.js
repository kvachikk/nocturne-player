import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULTS, normalize } from '../../src/lib/settings.js';

test('a fresh profile starts with no colour treatment at all', () => {
  const settings = normalize(null);
  assert.equal(settings.brightness, 1);
  assert.equal(settings.contrast, 1);
  assert.equal(settings.saturate, 1);
  assert.equal(settings.warmth, 0);
});

test('a stored value outside its range falls back to neutral', () => {
  const settings = normalize({ contrast: 1.3e3, brightness: -4 });
  assert.equal(settings.contrast, DEFAULTS.contrast);
  assert.equal(settings.brightness, DEFAULTS.brightness);
});

test('a stored value of the wrong type falls back to neutral', () => {
  const settings = normalize({ saturate: '1.5', warmth: null });
  assert.equal(settings.saturate, DEFAULTS.saturate);
  assert.equal(settings.warmth, DEFAULTS.warmth);
});

test('a value the user really chose is kept', () => {
  const settings = normalize({ contrast: 1.15, warmth: 0.27 });
  assert.equal(settings.contrast, 1.15);
  assert.equal(settings.warmth, 0.27);
});

test('unknown keys never reach the running state', () => {
  const settings = normalize({ contrast: 1.1, somethingElse: true });
  assert.equal(settings.somethingElse, undefined);
  assert.deepEqual(Object.keys(settings).sort(), Object.keys(DEFAULTS).sort());
});
