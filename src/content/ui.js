import { createColorPanel } from './controls/colorpanel.js';
import { createEdgeStrip } from './controls/edgestrip.js';
import { createLock } from './controls/lock.js';
import { createMenu } from './controls/menu.js';
import { createQuality } from './video/quality.js';
import { createRecognizer } from './gestures/recognizer.js';
import { createSeekBar } from './controls/seekbar.js';
import { createTrackManager } from './video/tracks.js';
import { createVisuals } from './video/visuals.js';
import { el } from './shell.js';
import { ZONE } from './gestures/zones.js';

const CHROME_IDLE_MS = 3000;
const HOLD_RATE = 2;
const REWIND_STEP_SECONDS = 0.2;
const REWIND_TICK_MS = 100;
const TOAST_MS = 900;
const SKIP_SECONDS = 10;
const MAX_DIM = 0.75;
const DEFAULT_WARMTH = 0.35;

const ICON = {
  exit: 'M6 6l12 12M18 6L6 18',
  night: 'M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  colour:
    'M12 3a9 9 0 1 0 0 18 2.5 2.5 0 0 0 0-5h-1a2 2 0 0 1 0-4h3a5 5 0 0 0 0-9z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z',
  pip: 'M3 5h18v14H3zM12 12h7v5h-7z',
  menu: 'M4 7h16M4 12h16M4 17h16',
};

const buildButton = (label, path, onClick) => {
  const icon = el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
    el('path', { d: path }),
  ]);
  const attributes = { class: 'button', type: 'button', title: label };
  const button = el('button', attributes, [icon]);
  button.addEventListener('click', onClick);
  return button;
};

export const createOverlay = ({
  video,
  stage,
  shadow,
  layers,
  onExit,
  settings,
  onPersist,
}) => {
  const surface = el('div', { class: 'layer surface' });
  const toast = el('div', { class: 'toast' });
  const topbar = el('div', { class: 'topbar' });
  const chrome = el('div', { class: 'chrome' });
  const cueBox = el('div', { class: 'cue' });
  const filePicker = el('input', {
    type: 'file',
    class: 'file-picker',
    accept: '.srt,.vtt,text/vtt',
  });

  // Applied before the menu is built so its chips reflect the restored rate.
  video.playbackRate = settings.playbackRate;

  const visuals = createVisuals(video, stage);
  const quality = createQuality(video);
  const tracks = createTrackManager(video, (text) => {
    cueBox.textContent = text;
    cueBox.classList.toggle('is-visible', text !== '');
  });
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
      const dim = (1 - value) * MAX_DIM;
      layers.dim.style.opacity = String(dim);
      onPersist({ dim });
    },
  });

  // Late-bound so buttons and the recognizer can refer to each other without
  // either having to exist first.
  const buttons = { night: null, colour: null, menu: null };
  const gate = { setEnabled: () => {} };

  let chromeTimer = null;
  let rewindTimer = null;
  let toastTimer = null;
  let restingRate = video.playbackRate;
  let pinchBase = 1;
  let warmth = 0;

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

  const applyWarmth = (value) => {
    warmth = value;
    layers.warm.style.opacity = String(value);
    buttons.night?.setAttribute('aria-pressed', String(value > 0));
  };

  const togglePlay = () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    setChromeVisible(true);
  };

  const skip = (seconds) => {
    const limit = Number.isFinite(video.duration)
      ? video.duration
      : video.currentTime;
    const target = video.currentTime + seconds;
    video.currentTime = Math.min(limit, Math.max(0, target));
    showToast(`${seconds > 0 ? '+' : ''}${seconds}s`);
  };

  const stopRewind = () => {
    if (rewindTimer === null) return;
    clearInterval(rewindTimer);
    rewindTimer = null;
  };

  // playbackRate cannot go negative, so holding the left box steps the clock
  // backwards at roughly the 2x the right box plays forward at.
  const startRewind = () => {
    stopRewind();
    rewindTimer = setInterval(() => {
      video.currentTime = Math.max(0, video.currentTime - REWIND_STEP_SECONDS);
    }, REWIND_TICK_MS);
  };

  const colorPanel = createColorPanel((key, value) => {
    if (key === 'warmth') applyWarmth(value);
    else visuals.setColour({ [key]: value });
    onPersist({ [key]: value });
  });

  const lock = createLock(() => {
    gate.setEnabled(true);
    setChromeVisible(true);
  });

  const menu = createMenu({
    video,
    tracks,
    quality,
    onStyle: ({ scale }) => {
      cueBox.style.setProperty('--cue-scale', String(scale));
      onPersist({ subtitleScale: scale });
    },
    onPickFile: () => filePicker.click(),
    onRate: (rate) => {
      restingRate = rate;
      onPersist({ playbackRate: rate });
    },
  });

  // The Android file picker drops fullscreen, so the player re-enters once the
  // file has been read.
  filePicker.addEventListener('change', async () => {
    const file = filePicker.files?.[0];
    filePicker.value = '';
    if (!file) return;
    try {
      const id = tracks.addCues(file.name, await file.text());
      if (id === null) {
        showToast('No cues found');
        return;
      }
      tracks.select(id);
      menu.refreshSubtitles(id);
      showToast(file.name);
    } catch (error) {
      console.error('Nocturne: could not read subtitles', error);
      showToast('Could not read that file');
    }
    if (document.fullscreenElement !== stage) {
      stage.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  });

  const closePanel = () => {
    colorPanel.close();
    menu.close();
    buttons.colour?.setAttribute('aria-pressed', 'false');
    buttons.menu?.setAttribute('aria-pressed', 'false');
  };

  const dragTargets = {
    [ZONE.SEEK]: seekBar,
    [ZONE.VOLUME]: volume,
    [ZONE.DIM]: dimStrip,
  };

  const recognizer = createRecognizer(surface, {
    tap: ({ zone }) => {
      if (colorPanel.isOpen() || menu.isOpen()) {
        closePanel();
        return;
      }
      if (zone === ZONE.PAUSE) togglePlay();
      else setChromeVisible(chrome.hasAttribute('hidden'));
    },
    multiTap: ({ zone, count }) => {
      const seconds = (count - 1) * SKIP_SECONDS;
      if (zone === ZONE.HOLD_LEFT) skip(-seconds);
      else if (zone === ZONE.HOLD_RIGHT) skip(seconds);
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
    pinchStart: () => {
      pinchBase = visuals.beginPinch();
    },
    pinchMove: ({ scale }) => visuals.pinchTo(pinchBase * scale),
    pinchEnd: () => {
      const scale = visuals.endPinch();
      showToast(scale === 1 ? 'Fit' : `${scale.toFixed(2)}x`);
    },
  });

  gate.setEnabled = recognizer.setEnabled;

  buttons.night = buildButton('Night light', ICON.night, () => {
    applyWarmth(warmth > 0 ? 0 : DEFAULT_WARMTH);
    colorPanel.setValue('warmth', warmth);
    onPersist({ warmth });
  });

  buttons.colour = buildButton('Colour', ICON.colour, () => {
    menu.close();
    buttons.menu.setAttribute('aria-pressed', 'false');
    colorPanel.toggle();
    buttons.colour.setAttribute('aria-pressed', String(colorPanel.isOpen()));
  });

  buttons.menu = buildButton('Settings', ICON.menu, () => {
    colorPanel.close();
    buttons.colour.setAttribute('aria-pressed', 'false');
    menu.toggle();
    buttons.menu.setAttribute('aria-pressed', String(menu.isOpen()));
  });

  const lockButton = buildButton('Lock controls', ICON.lock, () => {
    closePanel();
    lock.engage();
    setChromeVisible(false);
    recognizer.setEnabled(false);
  });

  topbar.append(
    buildButton('Exit player', ICON.exit, () => onExit()),
    el('div', { class: 'spacer' }),
    buttons.night,
    buttons.colour,
    lockButton,
    buttons.menu,
  );

  // Firefox for Android has no Picture-in-Picture API yet, so the button
  // appears on its own once Gecko ships one.
  if (document.pictureInPictureEnabled) {
    const pip = buildButton('Picture in picture', ICON.pip, () => {
      video.requestPictureInPicture().catch(() => {});
    });
    topbar.insertBefore(pip, buttons.night);
  }

  chrome.append(
    topbar,
    colorPanel.root,
    menu.root,
    seekBar.root,
    volume.root,
    dimStrip.root,
  );

  const handlePlaybackChange = () => {
    visuals.setPaused(video.paused);
    setChromeVisible(true);
  };
  video.addEventListener('pause', handlePlaybackChange);
  video.addEventListener('play', handlePlaybackChange);

  const restoreSettings = () => {
    visuals.setColour({
      brightness: settings.brightness,
      contrast: settings.contrast,
      saturate: settings.saturate,
    });
    for (const key of ['brightness', 'contrast', 'saturate', 'warmth']) {
      colorPanel.setValue(key, settings[key]);
    }
    applyWarmth(settings.warmth);
    cueBox.style.setProperty('--cue-scale', String(settings.subtitleScale));
    dimStrip.set(1 - settings.dim / MAX_DIM);
    layers.dim.style.opacity = String(settings.dim);
  };

  volume.set(video.volume);
  dimStrip.set(1);
  restoreSettings();
  shadow.append(surface, cueBox, chrome, lock.veil, toast, filePicker);
  setChromeVisible(true);

  return {
    destroy: () => {
      recognizer.destroy();
      seekBar.destroy();
      lock.destroy();
      tracks.destroy();
      stopRewind();
      if (chromeTimer !== null) clearTimeout(chromeTimer);
      if (toastTimer !== null) clearTimeout(toastTimer);
      video.removeEventListener('pause', handlePlaybackChange);
      video.removeEventListener('play', handlePlaybackChange);
    },
  };
};
