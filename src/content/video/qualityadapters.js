import {
  call,
  findGlobalMatch,
  isFunction,
  read,
  toArray,
  toPage,
  write,
} from './pageapi.js';

export const AUTO_ID = 'auto';

const YOUTUBE_LABELS = {
  tiny: '144p',
  small: '240p',
  medium: '360p',
  large: '480p',
  hd720: '720p',
  hd1080: '1080p',
  hd1440: '1440p',
  hd2160: '2160p',
  highres: '4320p',
};

const YOUTUBE_LOWEST = 'tiny';
const YOUTUBE_HIGHEST = 'highres';

// Best first, which is both the order the chips want and the order the ladder
// is read in.
const YOUTUBE_LADDER = [
  { key: 'highres', height: 4320 },
  { key: 'hd2160', height: 2160 },
  { key: 'hd1440', height: 1440 },
  { key: 'hd1080', height: 1080 },
  { key: 'hd720', height: 720 },
  { key: 'large', height: 480 },
  { key: 'medium', height: 360 },
  { key: 'small', height: 240 },
  { key: 'tiny', height: 144 },
];

const youtubeKeyFor = (height) => {
  for (const rung of YOUTUBE_LADDER) {
    if (height >= rung.height) return rung.key;
  }
  return 'tiny';
};

const inLadderOrder = (keys) =>
  YOUTUBE_LADDER.filter((rung) => keys.has(rung.key)).map((rung) => rung.key);

const heightLabel = (height, fallback) =>
  typeof height === 'number' && height > 0 ? `${height}p` : fallback;

// Highest first: the reason anyone opens this list is to force a better
// picture, so the answer they want is the first chip.
const byHeightDescending = (first, second) => second.height - first.height;

// --- Plain <source> children -------------------------------------------------

const sourceLabel = (source, index) => {
  const explicit = source.dataset.label || source.getAttribute('title');
  if (explicit) return explicit;
  const match = /(\d{3,4})[pP]/.exec(source.src);
  return match ? `${match[1]}p` : `Source ${index + 1}`;
};

const createSourceAdapter = (video) => {
  const sources = Array.from(video.querySelectorAll('source'));
  if (sources.length < 2) return null;

  const options = sources.map((source, index) => ({
    id: String(index),
    label: sourceLabel(source, index),
    src: source.src,
  }));

  return {
    name: 'sources',
    hasAuto: false,
    list: () => options.map(({ id, label }) => ({ id, label })),
    current: () => {
      const found = options.find((option) => option.src === video.currentSrc);
      return found ? found.id : null;
    },
    // The element is reloaded, so the position and the playing state are
    // carried across by hand.
    select: (id) => {
      const option = options.find((entry) => entry.id === id);
      if (!option || video.currentSrc === option.src) return false;

      const resumeAt = video.currentTime;
      const wasPlaying = !video.paused;
      const restore = () => {
        video.removeEventListener('loadedmetadata', restore);
        video.currentTime = resumeAt;
        if (wasPlaying) video.play().catch(() => {});
      };

      video.addEventListener('loadedmetadata', restore);
      video.src = option.src;
      video.load();
      return true;
    },
  };
};

// --- YouTube -----------------------------------------------------------------

const findYouTubePlayer = (host) => {
  if (host !== null && isFunction(host, 'getAvailableQualityLevels')) {
    return host;
  }
  const element = document.querySelector('#movie_player, .html5-video-player');
  if (element === null) return null;
  const player = element.wrappedJSObject ?? element;
  return isFunction(player, 'getAvailableQualityLevels') ? player : null;
};

const createYouTubeAdapter = (video, host) => {
  const player = findYouTubePlayer(host);
  if (player === null) return null;

  // YouTube reports the quality it is actually playing, which on auto keeps
  // moving. The chip should show what the user asked for, so the choice is
  // remembered here and the played value is only the opening guess.
  let chosen = null;

  const advertised = () =>
    toArray(call(player, 'getAvailableQualityLevels')).filter(
      (level) => typeof level === 'string' && level !== AUTO_ID,
    );

  // The phone player answers getAvailableQualityLevels() with nothing at all,
  // so the ladder is worked out from the formats the video actually has. Every
  // one of them carries the height it was encoded at, which is the same thing
  // the quality names stand for.
  const fromFormats = () => {
    const response = call(player, 'getPlayerResponse');
    const streaming = read(response, 'streamingData');
    const formats = toArray(read(streaming, 'adaptiveFormats')).concat(
      toArray(read(streaming, 'formats')),
    );

    const keys = new Set();
    for (const format of formats) {
      const height = read(format, 'height');
      if (typeof height === 'number' && height > 0) {
        keys.add(youtubeKeyFor(height));
      }
    }
    return inLadderOrder(keys);
  };

  const levels = () => {
    const listed = advertised();
    return listed.length > 0 ? listed : fromFormats();
  };

  return {
    name: 'youtube',
    hasAuto: true,
    // Which of the two ways in produced something, in the words of whoever has
    // to work out why a film is not offering the rung they want.
    diagnose: () =>
      `${advertised().length} listed, ${fromFormats().length} in formats`,
    list: () =>
      levels().map((level) => ({
        id: level,
        label: YOUTUBE_LABELS[level] ?? level,
      })),
    current: () => {
      if (chosen !== null) return chosen;
      const quality = call(player, 'getPlaybackQuality');
      return typeof quality === 'string' ? quality : null;
    },
    // Both calls together: the range is what pins the ladder for the rest of
    // the video, while setPlaybackQuality is what older players listen to.
    select: (id) => {
      chosen = id;
      if (id === AUTO_ID) {
        call(
          player,
          'setPlaybackQualityRange',
          YOUTUBE_LOWEST,
          YOUTUBE_HIGHEST,
        );
        call(player, 'setPlaybackQuality', AUTO_ID);
        return true;
      }
      call(player, 'setPlaybackQualityRange', id, id);
      call(player, 'setPlaybackQuality', id);
      return true;
    },
  };
};

// --- hls.js ------------------------------------------------------------------

const isHlsEngine = (value) =>
  Array.isArray(read(value, 'levels')) &&
  typeof read(value, 'currentLevel') === 'number';

const findHlsOnElement = (video) => {
  const attached = ['hls', '_hls', '__hls', 'hlsPlayer'];
  const element = video.wrappedJSObject ?? video;
  for (const key of attached) {
    const candidate = read(element, key);
    if (candidate && isHlsEngine(candidate)) return candidate;
  }
  return null;
};

const buildHlsAdapter = (engine) => {
  const levels = () =>
    toArray(read(engine, 'levels')).map((level, index) => ({
      index,
      height: read(level, 'height') ?? 0,
      bitrate: read(level, 'bitrate') ?? 0,
    }));

  return {
    name: 'hls.js',
    hasAuto: true,
    list: () =>
      levels()
        .sort(byHeightDescending)
        .map((level) => ({
          id: String(level.index),
          label: heightLabel(
            level.height,
            `${Math.round(level.bitrate / 1000)}k`,
          ),
        })),
    current: () => {
      const level = read(engine, 'currentLevel');
      return typeof level === 'number' && level >= 0 ? String(level) : AUTO_ID;
    },
    select: (id) => {
      const index = id === AUTO_ID ? -1 : Number(id);
      if (Number.isNaN(index)) return false;
      write(engine, 'nextLevel', index);
      return write(engine, 'currentLevel', index);
    },
  };
};

// --- dash.js -----------------------------------------------------------------

const isDashPlayer = (value) =>
  isFunction(value, 'getBitrateInfoListFor') &&
  isFunction(value, 'setQualityFor');

const buildDashAdapter = (player) => {
  const setAuto = (isOn) => {
    call(
      player,
      'updateSettings',
      toPage({ streaming: { abr: { autoSwitchBitrate: { video: isOn } } } }),
    );
  };

  const levels = () =>
    toArray(call(player, 'getBitrateInfoListFor', 'video')).map((info) => ({
      index: read(info, 'qualityIndex') ?? 0,
      height: read(info, 'height') ?? 0,
      bitrate: read(info, 'bitrate') ?? 0,
    }));

  return {
    name: 'dash.js',
    hasAuto: true,
    list: () =>
      levels()
        .sort(byHeightDescending)
        .map((level) => ({
          id: String(level.index),
          label: heightLabel(
            level.height,
            `${Math.round(level.bitrate / 1000)}k`,
          ),
        })),
    current: () => {
      const index = call(player, 'getQualityFor', 'video');
      return typeof index === 'number' ? String(index) : null;
    },
    select: (id) => {
      if (id === AUTO_ID) {
        setAuto(true);
        return true;
      }
      const index = Number(id);
      if (Number.isNaN(index)) return false;
      setAuto(false);
      call(player, 'setQualityFor', 'video', index, true);
      return true;
    },
  };
};

// --- Shaka Player ------------------------------------------------------------

const isShakaPlayer = (value) =>
  isFunction(value, 'getVariantTracks') &&
  isFunction(value, 'selectVariantTrack');

const buildShakaAdapter = (player) => {
  // The originals are handed back to selectVariantTrack untouched: a track is
  // a page object, and only the page's own object is accepted there.
  let known = new Map();

  const collect = () => {
    known = new Map();
    return toArray(call(player, 'getVariantTracks')).map((track) => {
      const id = String(read(track, 'id'));
      known.set(id, track);
      return {
        id,
        height: read(track, 'height') ?? 0,
        bandwidth: read(track, 'bandwidth') ?? 0,
        isActive: read(track, 'active') === true,
      };
    });
  };

  return {
    name: 'shaka',
    hasAuto: true,
    list: () =>
      collect()
        .sort(byHeightDescending)
        .map((track) => ({
          id: track.id,
          label: heightLabel(
            track.height,
            `${Math.round(track.bandwidth / 1000)}k`,
          ),
        })),
    current: () => {
      const active = collect().find((track) => track.isActive);
      return active ? active.id : null;
    },
    select: (id) => {
      if (id === AUTO_ID) {
        call(player, 'configure', toPage({ abr: { enabled: true } }));
        return true;
      }
      if (known.size === 0) collect();
      const track = known.get(id);
      if (track === undefined) return false;
      call(player, 'configure', toPage({ abr: { enabled: false } }));
      call(player, 'selectVariantTrack', track, true);
      return true;
    },
  };
};

const BUILDERS = {
  hls: buildHlsAdapter,
  dash: buildDashAdapter,
  shaka: buildShakaAdapter,
};

const MATCHERS = [
  { name: 'hls', matches: isHlsEngine },
  { name: 'dash', matches: isDashPlayer },
  { name: 'shaka', matches: isShakaPlayer },
];

// One sweep of the page's globals for all three streaming engines, after the
// cheap check of whether the engine is hanging off the element itself.
const createStreamAdapter = (video, host) => {
  if (host !== null && isHlsEngine(host)) return buildHlsAdapter(host);

  const attached = findHlsOnElement(video);
  if (attached !== null) return buildHlsAdapter(attached);

  const found = findGlobalMatch(MATCHERS);
  if (found === null) return null;
  return BUILDERS[found.name](found.value);
};

// Cheapest and most certain first: a <source> list is unambiguous, a named
// player is next, and the sweep of page globals is the last thing tried.
export const ADAPTERS = [
  createSourceAdapter,
  createYouTubeAdapter,
  createStreamAdapter,
];
