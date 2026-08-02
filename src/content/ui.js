import { createColorPanel } from './controls/colorpanel.js';
import { createMenu } from './controls/menu.js';
import { createQuality } from './video/quality.js';
import { createRecognizer } from './gestures/recognizer.js';
import { createSeekBar } from './controls/seekbar.js';
import { createTrackManager } from './video/tracks.js';
import { createVisuals } from './video/visuals.js';
import { el } from './shell.js';
import { ZONE } from './gestures/zones.js';

const CHROME_IDLE_MS = 3000;
const SCRUB_STEP_SECONDS = 0.2;
const SCRUB_TICK_MS = 100;
const TOAST_MS = 900;
const SKIP_SECONDS = 10;
const FILL_RETRY_MS = 400;

const ICON = {
  exit: 'M6 6l12 12M18 6L6 18',
  colour:
    'M12 3a9 9 0 1 0 0 18 2.5 2.5 0 0 0 0-5h-1a2 2 0 0 1 0-4h3a5 5 0 0 0 0-9z',
  pip: 'M3 5h18v14H3zM12 12h7v5h-7z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  play: 'M8 5 19 12 8 19z',
  pause: 'M7.5 4.5h3.4v15H7.5zM13.1 4.5h3.4v15h-3.4z',
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

// A ring with an arrowhead and the number inside, the way phone players draw
// their skip controls.
const buildSkipIcon = (seconds) => {
  const isForward = seconds > 0;
  const arc = isForward
    ? 'M12 4.5A7.5 7.5 0 1 0 19.5 12'
    : 'M12 4.5A7.5 7.5 0 1 1 4.5 12';
  const head = isForward
    ? 'M12 1.4 12 7.6 15.6 4.5z'
    : 'M12 1.4 12 7.6 8.4 4.5z';

  return el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
    el('path', { d: arc }),
    el('path', { d: head, fill: 'currentColor', stroke: 'none' }),
    el('text', {
      x: '12',
      y: '15.6',
      'text-anchor': 'middle',
      'font-size': '8.5',
      'font-weight': '600',
      fill: 'currentColor',
      stroke: 'none',
      text: String(Math.abs(seconds)),
    }),
  ]);
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

  let chromeTimer = null;
  let scrubTimer = null;
  let toastTimer = null;
  let pinchBase = 1;
  let wasPlayingBeforeScrub = false;

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
    onRate: () => {},
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

  const stopScrub = () => {
    if (scrubTimer === null) return;
    clearInterval(scrubTimer);
    scrubTimer = null;
    visuals.suppressFade(false);
    if (wasPlayingBeforeScrub) video.play().catch(() => {});
  };

  // Both directions step the clock rather than lean on playbackRate, which
  // Firefox for Android does not reliably honour. Playback is held still while
  // stepping, otherwise forward would run at 3x and back at only 1x.
  const startScrub = (direction) => {
    stopScrub();
    wasPlayingBeforeScrub = !video.paused;
    video.pause();
    visuals.suppressFade(true);
    scrubTimer = setInterval(() => {
      const limit = Number.isFinite(video.duration)
        ? video.duration
        : video.currentTime;
      const target = video.currentTime + direction * SCRUB_STEP_SECONDS;
      video.currentTime = Math.min(limit, Math.max(0, target));
    }, SCRUB_TICK_MS);
  };

  const dragTargets = { [ZONE.SEEK]: seekBar };

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
      const isForward = zone === ZONE.HOLD_RIGHT;
      startScrub(isForward ? 1 : -1);
      showToast(isForward ? '2x ▶▶' : '◀◀ 2x');
    },
    holdEnd: () => stopScrub(),
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
    pinchEnd: () => visuals.endPinch(),
  });

  buttons.play = buildButton(
    'Play or pause',
    video.paused ? ICON.play : ICON.pause,
    togglePlay,
    'play-button',
  );
  const playPath = buttons.play.querySelector('path');

  const buildSkipButton = (seconds) => {
    const attributes = {
      class: 'skip-button',
      type: 'button',
      title: `${seconds > 0 ? 'Forward' : 'Back'} ${Math.abs(seconds)} seconds`,
    };
    const button = el('button', attributes, [buildSkipIcon(seconds)]);
    button.addEventListener('click', () => {
      skip(seconds);
      setChromeVisible(true);
    });
    return button;
  };

  const centreRow = el('div', { class: 'centre-row' }, [
    buildSkipButton(-SKIP_SECONDS),
    buttons.play,
    buildSkipButton(SKIP_SECONDS),
  ]);

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

  topbar.append(
    buildButton('Exit player', ICON.exit, () => onExit()),
    el('div', { class: 'spacer' }),
    buttons.colour,
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

  chrome.append(topbar, centreRow, colorPanel.root, menu.root, seekBar.root);

  // Only the path data changes, so swapping play for pause cannot make the
  // button flicker or shift.
  const handlePlaybackChange = () => {
    visuals.setPaused(video.paused);
    playPath.setAttribute('d', video.paused ? ICON.play : ICON.pause);
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

  restoreSettings();
  fillWhenReady();
  shadow.append(surface, cueBox, chrome, toast, filePicker);
  setChromeVisible(true);

  return {
    destroy: () => {
      recognizer.destroy();
      seekBar.destroy();
      tracks.destroy();
      stopScrub();
      if (chromeTimer !== null) clearTimeout(chromeTimer);
      if (toastTimer !== null) clearTimeout(toastTimer);
      video.removeEventListener('pause', handlePlaybackChange);
      video.removeEventListener('play', handlePlaybackChange);
    },
  };
};
