import { createEdgeStrip } from './controls/edgestrip.js';
import { createRecognizer } from './gestures/recognizer.js';
import { createSeekBar } from './controls/seekbar.js';
import { el } from './shell.js';
import { ZONE } from './gestures/zones.js';

const CHROME_IDLE_MS = 3000;
const HOLD_RATE = 2;
const REWIND_STEP_SECONDS = 0.2;
const REWIND_TICK_MS = 100;
const TOAST_MS = 900;
const SKIP_SECONDS = 10;
const MAX_DIM = 0.75;

const buildIcon = (path) =>
  el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
    el('path', { d: path }),
  ]);

const buildButton = (label, path, onClick) => {
  const attributes = { class: 'button', type: 'button', title: label };
  const button = el('button', attributes, [buildIcon(path)]);
  button.addEventListener('click', onClick);
  return button;
};

export const createOverlay = ({ video, shadow, layers, onExit }) => {
  const surface = el('div', { class: 'layer surface' });
  const toast = el('div', { class: 'toast' });

  const seekBar = createSeekBar(video);
  const volume = createEdgeStrip({
    side: 'right',
    topGlyph: '+',
    bottomGlyph: '−',
    onChange: (value) => {
      video.muted = false;
      video.volume = value;
    },
  });
  const dimStrip = createEdgeStrip({
    side: 'left',
    topGlyph: '☀',
    bottomGlyph: '☾',
    onChange: (value) => {
      layers.dim.style.opacity = String((1 - value) * MAX_DIM);
    },
  });

  const topbar = el('div', { class: 'topbar' }, [
    buildButton('Exit player', 'M6 6l12 12M18 6L6 18', () => onExit()),
    el('div', { class: 'spacer' }),
  ]);

  const chrome = el('div', { class: 'chrome' }, [
    topbar,
    seekBar.root,
    volume.root,
    dimStrip.root,
  ]);

  volume.set(video.volume);
  dimStrip.set(1);

  let chromeTimer = null;
  let rewindTimer = null;
  let toastTimer = null;
  let restingRate = video.playbackRate;

  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add('is-visible');
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastTimer = null;
      toast.classList.remove('is-visible');
    }, TOAST_MS);
  };

  const setChromeVisible = (isVisible) => {
    chrome.toggleAttribute('hidden', !isVisible);
    if (chromeTimer !== null) clearTimeout(chromeTimer);
    chromeTimer = null;
    if (!isVisible || video.paused) return;
    chromeTimer = setTimeout(() => {
      chromeTimer = null;
      chrome.toggleAttribute('hidden', true);
    }, CHROME_IDLE_MS);
  };

  const togglePlay = () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    setChromeVisible(true);
  };

  const skip = (seconds) => {
    video.currentTime = Math.min(
      Number.isFinite(video.duration) ? video.duration : video.currentTime,
      Math.max(0, video.currentTime + seconds),
    );
    showToast(`${seconds > 0 ? '+' : ''}${seconds}s`);
  };

  const stopRewind = () => {
    if (rewindTimer === null) return;
    clearInterval(rewindTimer);
    rewindTimer = null;
  };

  // playbackRate cannot go negative, so holding the left box steps the clock
  // backwards at roughly the same 2x the right box plays forward at.
  const startRewind = () => {
    stopRewind();
    rewindTimer = setInterval(() => {
      video.currentTime = Math.max(0, video.currentTime - REWIND_STEP_SECONDS);
    }, REWIND_TICK_MS);
  };

  const dragTargets = {
    [ZONE.SEEK]: seekBar,
    [ZONE.VOLUME]: volume,
    [ZONE.DIM]: dimStrip,
  };

  const recognizer = createRecognizer(surface, {
    tap: ({ zone }) => {
      if (zone === ZONE.PAUSE) togglePlay();
      else setChromeVisible(chrome.hasAttribute('hidden'));
    },
    multiTap: ({ zone, count }) => {
      const steps = (count - 1) * SKIP_SECONDS;
      if (zone === ZONE.HOLD_LEFT) skip(-steps);
      else if (zone === ZONE.HOLD_RIGHT) skip(steps);
      else setChromeVisible(chrome.hasAttribute('hidden'));
    },
    holdStart: ({ zone }) => {
      if (zone === ZONE.HOLD_RIGHT) {
        restingRate = video.playbackRate;
        video.playbackRate = HOLD_RATE;
        showToast('2x ▶▶');
        return;
      }
      startRewind();
      showToast('◀◀ 2x');
    },
    holdEnd: ({ zone }) => {
      if (zone === ZONE.HOLD_RIGHT) video.playbackRate = restingRate;
      else stopRewind();
    },
    dragStart: ({ zone }) => {
      setChromeVisible(true);
      dragTargets[zone]?.start();
    },
    dragMove: (detail) => dragTargets[detail.zone]?.move(detail),
    dragEnd: ({ zone }) => dragTargets[zone]?.end(),
  });

  const handlePlaybackChange = () => setChromeVisible(true);
  video.addEventListener('pause', handlePlaybackChange);
  video.addEventListener('play', handlePlaybackChange);

  shadow.append(surface, chrome, toast);
  setChromeVisible(true);

  return {
    destroy: () => {
      recognizer.destroy();
      seekBar.destroy();
      stopRewind();
      if (chromeTimer !== null) clearTimeout(chromeTimer);
      if (toastTimer !== null) clearTimeout(toastTimer);
      video.removeEventListener('pause', handlePlaybackChange);
      video.removeEventListener('play', handlePlaybackChange);
    },
  };
};
