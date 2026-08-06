// Everything a site's own player knows about itself — the quality ladder, the
// caption list — lives in the page's JavaScript, which a content script sees
// only through Gecko's Xray wrappers. Waiving those wrappers is the supported
// way in on Firefox, and it stays a read of objects the page already made: no
// code is injected into the page and nothing is evaluated from a string.
//
// Nothing here can throw at the caller. A site is free to have a getter that
// raises, a method that is missing, or a value from a compartment we cannot
// touch; every one of those means "this player cannot do that", not "the
// player is broken".
const MAX_SCANNED_KEYS = 500;

export const pageWindow = () => window.wrappedJSObject ?? window;

// Structured-cloned into the page's compartment so a page function can read it.
// Falls back to the plain value where the helper is absent, which is a context
// that already shares one compartment with the page.
export const toPage = (value) => {
  if (typeof cloneInto !== 'function') return value;
  try {
    return cloneInto(value, pageWindow());
  } catch {
    return value;
  }
};

export const read = (object, key) => {
  if (object === null || typeof object !== 'object') return null;
  try {
    const value = object[key];
    return value === undefined ? null : value;
  } catch {
    return null;
  }
};

export const call = (object, name, ...args) => {
  if (object === null || typeof object !== 'object') return null;
  let method = null;
  try {
    method = object[name];
  } catch {
    return null;
  }
  if (typeof method !== 'function') return null;
  try {
    const value = method.apply(object, args);
    return value === undefined ? null : value;
  } catch (error) {
    console.warn(`Nocturne: ${name}() failed on the site's player`, error);
    return null;
  }
};

export const write = (object, key, value) => {
  if (object === null || typeof object !== 'object') return false;
  try {
    object[key] = value;
    return true;
  } catch {
    return false;
  }
};

// Page arrays come from another compartment, so they are walked by index
// rather than spread: an iterator that throws must not take the player down.
export const toArray = (value) => {
  const length = read(value, 'length');
  if (typeof length !== 'number' || !Number.isFinite(length)) return [];
  const items = [];
  for (let index = 0; index < length; index++) {
    items.push(read(value, index));
  }
  return items;
};

export const isFunction = (object, name) => {
  if (object === null || typeof object !== 'object') return false;
  try {
    return typeof object[name] === 'function';
  } catch {
    return false;
  }
};

// A last resort for players that keep their engine on a global under a name
// only they know. Bounded, and every property read is guarded, because a getter
// on a page global can throw or be expensive.
export const findGlobal = (matches) => {
  const scope = pageWindow();
  let keys = [];
  try {
    keys = Object.keys(scope);
  } catch {
    return null;
  }

  const limit = Math.min(keys.length, MAX_SCANNED_KEYS);
  for (let index = 0; index < limit; index++) {
    const value = read(scope, keys[index]);
    if (value === null || typeof value !== 'object') continue;
    try {
      if (matches(value)) return value;
    } catch {
      continue;
    }
  }
  return null;
};
