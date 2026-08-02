const STORAGE_KEY = 'nocturne';
const SCHEMA_VERSION = 1;

export const DEFAULTS = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  warmth: 0,
  brightness: 1,
  contrast: 1,
  saturate: 1,
  doubleTapSeconds: 10,
  holdSpeed: 2,
  isAutoLandscapeOn: true,
  isFullscreenTakeoverOn: true,
  areEffectsReduced: false,
  subtitleScale: 1,
  areSubtitlesNative: false,
  disabledHosts: [],
});

const KEYS = Object.keys(DEFAULTS);

// Rebuilt key by key so every settings object shares one hidden class, and so
// unknown keys from a future version can never leak into the running state.
const normalize = (stored) => {
  const settings = {};
  for (const key of KEYS) {
    const value = stored?.[key];
    settings[key] = value === undefined ? DEFAULTS[key] : value;
  }
  settings.schemaVersion = SCHEMA_VERSION;
  settings.disabledHosts = Array.isArray(settings.disabledHosts)
    ? settings.disabledHosts.slice()
    : [];
  return settings;
};

export const readSettings = async () => {
  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    return normalize(stored[STORAGE_KEY]);
  } catch (error) {
    console.error('Nocturne: could not read settings', error);
    return normalize(null);
  }
};

export const writeSettings = async (patch) => {
  const current = await readSettings();
  const next = normalize({ ...current, ...patch });
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: next });
  } catch (error) {
    console.error('Nocturne: could not save settings', error);
  }
  return next;
};

export const resetSettings = async () => {
  try {
    await browser.storage.local.remove(STORAGE_KEY);
  } catch (error) {
    console.error('Nocturne: could not reset settings', error);
  }
  return normalize(null);
};

export const onSettingsChanged = (handler) => {
  const listener = (changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    handler(normalize(changes[STORAGE_KEY].newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
};

export const isHostEnabled = (settings, host) =>
  !settings.disabledHosts.includes(host);

export const setHostEnabled = async (host, isEnabled) => {
  const settings = await readSettings();
  const others = settings.disabledHosts.filter((entry) => entry !== host);
  const disabledHosts = isEnabled ? others : others.concat(host);
  return writeSettings({ disabledHosts });
};
