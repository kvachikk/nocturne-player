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
const FILL_RETRY_MS = 400;

const ICON = {
  exit: 'M6 6l12 12M18 6L6 18',
  colour:
    'M12 3a9 9 0 1 0 0 18 2.5 2.5 0 0 0 0-5h-1a2 2 0 0 1 0-4h3a5 5 0 0 0 0-9z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z',
  pip: 'M3 5h18v14H3zM12 12h7v5h-7z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  play: 'M8 5.5 18 12 8 18.5z',
  pause: 'M9 5v14M15 5v14',
};

const buildIcon = (path) =>
  el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
    el('path', { d: path }),
  ]);

const buildButton = (label, path, onClick, className = 'button') => {
  const attributes = { class: className, type: 'button', title: label };
  const button = el('button', attributes, [buildIcon(path)]);
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
  wasPlaying,
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

  // Late-bound: buttons, the recognizer and the track manager all need to refer
  // to things created after them.
  const buttons = { colour: null, menu: null, play: null };
  const menuRef = { setSubtitle: () => {} };
  const gate = { setEnabled: () => {} };

  // Playback speed is deliberately not restored: it belongs to the film you
  // were watching, not to the next one.
  video.playbackRate = 1;

  const visuals = createVisuals(video, stage, wasPlaying);
  const quality = createQuality(video);
  const tracks = createTrackManager(
    video,
    (text) => {
      cueBox.textContent = text;
      cueBox.classList.toggle('is-visible', text !== '');
    },
    (id) => menuRef.setSubtitle(id),
  );

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

  let chromeTimer = null;
  let rewindTimer = null;
  let toastTimer = null;
  let restingRate = video.playbackRate;
  let pinchBase = 1;

  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add('is-visible');
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastTimer = null;
      toast.classList.remove('is-visible');
    }, TOAST_MS);
  };

  const applyWarmth = (value) => {
    layers.warm.style.opacity = String(value);
  };

  const colorPanel = createColorPanel((key, value) => {
    if (key === 'warmth') applyWarmth(value);
    else visuals.setColour({ [key]: value });
    onPersist({ [key]: value });
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
    },
  });

  menuRef.setSubtitle = menu.setSubtitle;

  const isPanelOpen = () => colorPanel.isOpen() || menu.isOpen();

  // The chrome must never fade out from under an open panel: the panel lives
  // inside it, and hiding it mid-adjustment looked like the player had frozen.
  const setChromeVisible = (isVisible) => {
    chrome.toggleAttribute('hidden', !isVisible);
    if (chromeTimer !== null) clearTimeout(chromeTimer);
    chromeTimer = null;
    if (!isVisible || video.paused || isPanelOpen()) return;
    chromeTimer = setTimeout(() => {
      chromeTimer = null;
      chrome.toggleAttribute('hidden', true);
    }, CHROME_IDLE_MS);
  };

  const closePanels = () => {
    colorPanel.close();
    menu.close();
    visuals.suppressFade(false);
    buttons.colour?.setAttribute('aria-pressed', 'false');
    buttons.menu?.setAttribute('aria-pressed', 'false');
    setChromeVisible(true);
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

  const lock = createLock(() => {
    gate.setEnabled(true);
    setChromeVisible(true);
  });

  const dragTargets = { [ZONE.SEEK]: seekBar, [ZONE.VOLUME]: volume };

  const recognizer = createRecognizer(surface, {
    tap: ({ zone }) => {
      if (isPanelOpen()) {
        closePanels();
        return;
      }
      if (zone === ZONE.PAUSE) togglePlay();
      else setChromeVisible(chrome.hasAttribute('hidden'));
    },
    multiTap: ({ zone, count }) => {
      if (isPanelOpen()) {
        closePanels();
        return;
      }
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
      showToast(scale === 1 ? 'Fit' : 'Filled');
    },
  });

  gate.setEnabled = recognizer.setEnabled;

  buttons.play = buildButton(
    'Play or pause',
    video.paused ? ICON.play : ICON.pause,
    togglePlay,
    'play-button',
  );

  buttons.colour = buildButton('Colour', ICON.colour, () => {
    menu.close();
    buttons.menu.setAttribute('aria-pressed', 'false');
    colorPanel.toggle();
    const isOpen = colorPanel.isOpen();
    buttons.colour.setAttribute('aria-pressed', String(isOpen));
    visuals.suppressFade(isOpen);
    setChromeVisible(true);
  });

  buttons.menu = buildButton('Settings', ICON.menu, () => {
    colorPanel.close();
    visuals.suppressFade(false);
    buttons.colour.setAttribute('aria-pressed', 'false');
    menu.toggle();
    buttons.menu.setAttribute('aria-pressed', String(menu.isOpen()));
    setChromeVisible(true);
  });

  const lockButton = buildButton('Lock controls', ICON.lock, () => {
    closePanels();
    lock.engage();
    setChromeVisible(false);
    recognizer.setEnabled(false);
  });

  topbar.append(
    buildButton('Exit player', ICON.exit, () => onExit()),
    el('div', { class: 'spacer' }),
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
    topbar.insertBefore(pip, buttons.colour);
  }

  chrome.append(
    topbar,
    buttons.play,
    colorPanel.root,
    menu.root,
    seekBar.root,
    volume.root,
  );

  const handlePlaybackChange = () => {
    visuals.setPaused(video.paused);
    buttons.play.replaceChildren(
      buildIcon(video.paused ? ICON.play : ICON.pause),
    );
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
  };

  // Black bars cropped from the start; metadata may not have arrived yet.
  const fillWhenReady = () => {
    if (visuals.fillScreen()) return;
    setTimeout(fillWhenReady, FILL_RETRY_MS);
  };

  volume.set(video.volume);
  restoreSettings();
  fillWhenReady();
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
