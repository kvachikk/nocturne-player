import {
  call,
  findGlobal,
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

const findYouTubePlayer = () => {
  const element = document.querySelector('#movie_player, .html5-video-player');
  if (element === null) return null;
  const player = element.wrappedJSObject ?? element;
  return isFunction(player, 'getAvailableQualityLevels') ? player : null;
};

const createYouTubeAdapter = () => {
  const player = findYouTubePlayer();
  if (player === null) return null;

  // YouTube reports the quality it is actually playing, which on auto keeps
  // moving. The chip should show what the user asked for, so the choice is
  // remembered here and the played value is only the opening guess.
  let chosen = null;

  const levels = () =>
    toArray(call(player, 'getAvailableQualityLevels')).filter(
      (level) => typeof level === 'string' && level !== AUTO_ID,
    );

  return {
    name: 'youtube',
    hasAuto: true,
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

const findHls = (video) => {
  const attached = ['hls', '_hls', '__hls', 'hlsPlayer'];
  const element = video.wrappedJSObject ?? video;
  for (const key of attached) {
    const candidate = read(element, key);
    if (candidate && isHlsEngine(candidate)) return candidate;
  }
  return findGlobal(isHlsEngine);
};

const createHlsAdapter = (video) => {
  const engine = findHls(video);
  if (engine === null) return null;

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

const createDashAdapter = () => {
  const player = findGlobal(isDashPlayer);
  if (player === null) return null;

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

const createShakaAdapter = () => {
  const player = findGlobal(isShakaPlayer);
  if (player === null) return null;

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

// Cheapest and most certain first: a <source> list is unambiguous, a named
// player is next, and the global scan is the last thing tried.
export const ADAPTERS = [
  createSourceAdapter,
  createYouTubeAdapter,
  createHlsAdapter,
  createDashAdapter,
  createShakaAdapter,
];
