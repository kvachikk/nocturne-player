import { readSiteChapters } from './video/chapters.js';
import { createColorPanel } from './controls/colorpanel.js';
import { createMenu } from './controls/menu.js';
import { createAudioTracks } from './video/audiotracks.js';
import { createPlaylist } from './video/playlist.js';
import { createQuality } from './video/quality.js';
import { createRecognizer } from './gestures/recognizer.js';
import { createSeekBar } from './controls/seekbar.js';
import { createSeeker } from './video/seek.js';
import { createTrackManager } from './video/tracks.js';
import { createVisuals } from './video/visuals.js';
import { el } from './shell.js';
import { ZONE } from './gestures/zones.js';

const CHROME_IDLE_MS = 3000;
const SCRUB_STEP_SECONDS = 0.2;
const SCRUB_TICK_MS = 100;
const TOAST_MS = 900;
const HINT_MS = 2200;
// Back is the button that undoes a line of dialogue you missed, forward the
// one that jumps an opening — they are not the same distance.
const SKIP_BACK_SECONDS = 5;
const SKIP_FORWARD_SECONDS = 10;
const PLAYLIST_SETTLE_MS = 600;
const FILL_RETRY_MS = 400;
const CHAPTER_TRIES_MS = [1200, 4000, 10000];
const FILL_ATTEMPTS = 25;

const ICON = {
  exit: 'M6 6l12 12M18 6L6 18',
  chevron: 'M7 10l5 5 5-5',
  colour:
    'M12 3a9 9 0 1 0 0 18 2.5 2.5 0 0 0 0-5h-1a2 2 0 0 1 0-4h3a5 5 0 0 0 0-9z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  play: 'M8 5 19 12 8 19z',
  pause: 'M6 5h3.6v14H6zM14.4 5h3.6v14h-3.6z',
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
  playerHost,
  onImmersiveChange,
}) => {
  const surface = el('div', { class: 'layer surface' });
  const scrim = el('div', { class: 'layer scrim' });
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
  const playlistRef = {
    refresh: () => {},
    isOpen: () => false,
    close: () => {},
  };

  // Playback speed is deliberately not restored: it belongs to the film you
  // were watching, not to the next one.
  video.playbackRate = 1;

  const visuals = createVisuals(video, stage);
  const quality = createQuality(video, playerHost);
  const audio = createAudioTracks(video, playerHost);
  const playlist = createPlaylist(video, playerHost);
  const tracks = createTrackManager(
    video,
    (text) => {
      cueBox.textContent = text;
      cueBox.classList.toggle('is-visible', text !== '');
    },
    (id) => menuRef.setSubtitle(id),
    playerHost,
  );

  const seek = createSeeker(video, playerHost);
  const seekBar = createSeekBar(video, seek);

  let chromeTimer = null;
  let scrubTimer = null;
  let toastTimer = null;
  let pinchBase = 1;
  let wasPlayingBeforeScrub = false;

  const showToast = (text, duration = TOAST_MS) => {
    toast.textContent = text;
    toast.classList.add('is-visible');
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastTimer = null;
      toast.classList.remove('is-visible');
    }, duration);
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
    audio,
    onStyle: ({ scale }) => {
      cueBox.style.setProperty('--cue-scale', String(scale));
      onPersist({ subtitleScale: scale });
    },
    onPickFile: () => filePicker.click(),
    onRate: () => {},
    onNotice: (text) => showToast(text, HINT_MS),
    // Deliberately not persisted, the way playback speed is not: it belongs to
    // the film being watched now, and a viewer who dropped out of fullscreen
    // once should still get fullscreen from a button that says fullscreen.
    onImmersive: onImmersiveChange,
  });

  menuRef.setSubtitle = menu.setSubtitle;

  const isPanelOpen = () =>
    colorPanel.isOpen() || menu.isOpen() || playlistRef.isOpen();

  // The chrome must never fade out from under an open panel: the panel lives
  // inside it, and hiding it mid-adjustment looked like the player had frozen.
  const setChromeVisible = (isVisible) => {
    // Read again on the way in: an episode that finished and rolled on to the
    // next one has left the bar naming the one before it.
    if (isVisible) playlistRef.refresh();
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
    playlistRef.close();
    colorPanel.close();
    menu.close();
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
    seek(video.currentTime + seconds);
    showToast(`${seconds > 0 ? '+' : ''}${seconds}s`);
  };

  const stopScrub = () => {
    if (scrubTimer === null) return;
    clearInterval(scrubTimer);
    scrubTimer = null;
    if (wasPlayingBeforeScrub) video.play().catch(() => {});
  };

  // Both directions step the clock rather than lean on playbackRate, which
  // Firefox for Android does not reliably honour. Playback is held still while
  // stepping, otherwise forward would run at 3x and back at only 1x.
  const startScrub = (direction) => {
    stopScrub();
    wasPlayingBeforeScrub = !video.paused;
    video.pause();
    scrubTimer = setInterval(() => {
      seek(video.currentTime + direction * SCRUB_STEP_SECONDS);
    }, SCRUB_TICK_MS);
  };

  const dragTargets = { [ZONE.SEEK]: seekBar };

  const recognizer = createRecognizer(surface, {
    tap: () => {
      if (isPanelOpen()) {
        closePanels();
        return;
      }
      setChromeVisible(chrome.hasAttribute('hidden'));
    },
    multiTap: ({ zone, count }) => {
      if (isPanelOpen()) {
        closePanels();
        return;
      }
      const steps = count - 1;
      if (zone === ZONE.HOLD_LEFT) skip(-steps * SKIP_BACK_SECONDS);
      else if (zone === ZONE.HOLD_RIGHT) skip(steps * SKIP_FORWARD_SECONDS);
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
    buildSkipButton(-SKIP_BACK_SECONDS),
    buttons.play,
    buildSkipButton(SKIP_FORWARD_SECONDS),
  ]);

  buttons.colour = buildButton('Colour', ICON.colour, () => {
    menu.close();
    buttons.menu.setAttribute('aria-pressed', 'false');
    colorPanel.toggle();
    buttons.colour.setAttribute('aria-pressed', String(colorPanel.isOpen()));
    setChromeVisible(true);
  });

  buttons.menu = buildButton('Settings', ICON.menu, () => {
    colorPanel.close();
    buttons.colour.setAttribute('aria-pressed', 'false');
    menu.toggle();
    buttons.menu.setAttribute('aria-pressed', String(menu.isOpen()));
    setChromeVisible(true);
  });

  // The playlist sits where a thumb reaches it while the phone is held
  // sideways — beside the way out, not buried in the settings sheet, which is
  // no place to be changing episode from. One dropdown per step of the path
  // the player itself keeps: the season, then the episode.
  const playlistBar = el('div', { class: 'playlist-bar' });

  const closePlaylistLists = () => {
    for (const list of playlistBar.querySelectorAll('.playlist-list')) {
      list.toggleAttribute('hidden', true);
    }
  };

  const buildPlaylistPick = (level, index) => {
    const list = el('div', { class: 'playlist-list', hidden: '' });
    const value = el('button', { class: 'playlist-value', type: 'button' }, [
      el('span', { class: 'playlist-current' }, [level.current]),
      buildIcon(ICON.chevron),
    ]);

    value.addEventListener('click', () => {
      const wasOpen = !list.hasAttribute('hidden');
      closePlaylistLists();
      list.toggleAttribute('hidden', wasOpen);
    });

    for (const [option, label] of level.labels.entries()) {
      const isCurrent = label === level.current;
      const attributes = {
        class: isCurrent ? 'playlist-option is-current' : 'playlist-option',
        type: 'button',
      };
      const entry = el('button', attributes, [label]);
      entry.addEventListener('click', () => {
        closePlaylistLists();
        playlist.select(index, option);
        // The player rewrites its own path as it switches, so the bar is read
        // again rather than guessing what the press will have done — once now,
        // and once more after the step it had to fetch has landed.
        playlistRef.refresh();
        setTimeout(() => playlistRef.refresh(), PLAYLIST_SETTLE_MS);
      });
      list.append(entry);
    }

    return el('div', { class: 'playlist-pick' }, [value, list]);
  };

  // A series only admits to having a playlist once its player has drawn one, so
  // the bar appears when there is something to choose from and stays away when
  // the page is a film.
  playlistRef.refresh = () => {
    playlist.refresh();
    const levels = playlist.getLevels();
    playlistBar.replaceChildren(...levels.map(buildPlaylistPick));
    playlistBar.classList.toggle('is-empty', levels.length === 0);
  };
  playlistRef.isOpen = () =>
    playlistBar.querySelector('.playlist-list:not([hidden])') !== null;
  playlistRef.close = closePlaylistLists;
  playlistRef.refresh();

  topbar.append(
    buildButton('Exit player', ICON.exit, () => onExit()),
    playlistBar,
    el('div', { class: 'spacer' }),
    buttons.colour,
    buttons.menu,
  );

  chrome.append(
    scrim,
    topbar,
    centreRow,
    colorPanel.root,
    menu.root,
    seekBar.root,
  );

  // Reading a file the user picked themselves, straight into the cue list.
  // Nothing leaves the device and nothing is parsed as markup.
  const loadSubtitleFile = async () => {
    const file = filePicker.files?.[0];
    if (!file) return;
    const text = await file.text();
    filePicker.value = '';
    const id = tracks.addCues(file.name.replace(/\.(srt|vtt)$/i, ''), text);
    if (id === null) {
      showToast('No subtitles in that file', HINT_MS);
      return;
    }
    tracks.select(id);
    menu.refresh();
    showToast('Subtitles loaded', HINT_MS);
  };

  filePicker.addEventListener('change', () => {
    loadSubtitleFile().catch((error) => {
      console.error('Nocturne: could not read the subtitle file', error);
      showToast('Could not read that file', HINT_MS);
    });
  });

  // Only the path data changes, so swapping play for pause cannot make the
  // button flicker or shift.
  const handlePlaybackChange = () => {
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

  // Black bars cropped from the start; metadata may not have arrived yet. The
  // retry gives up rather than ticking for as long as the film lasts on a
  // stream that never reports its dimensions.
  let fillAttempts = 0;
  const fillWhenReady = () => {
    if (visuals.fillScreen()) return;
    fillAttempts += 1;
    if (fillAttempts >= FILL_ATTEMPTS) return;
    setTimeout(fillWhenReady, FILL_RETRY_MS);
  };

  // Walking the site's page data is not free, so it happens after the picture
  // is up rather than in the way of it — and more than once, because a page
  // that was navigated to fills its data in some time after the video starts.
  const chapterTimers = CHAPTER_TRIES_MS.map((delay) =>
    setTimeout(() => {
      const chapters = readSiteChapters(playerHost);
      if (chapters.length > 0) seekBar.setChapters(chapters);
    }, delay),
  );

  restoreSettings();
  fillWhenReady();
  shadow.append(surface, cueBox, chrome, toast, filePicker);
  setChromeVisible(true);

  return {
    relayout: () => visuals.relayout(),
    repin: () => visuals.repin(),
    destroy: () => {
      recognizer.destroy();
      seekBar.destroy();
      tracks.destroy();
      stopScrub();
      if (chromeTimer !== null) clearTimeout(chromeTimer);
      if (toastTimer !== null) clearTimeout(toastTimer);
      for (const timer of chapterTimers) clearTimeout(timer);
      video.removeEventListener('pause', handlePlaybackChange);
      video.removeEventListener('play', handlePlaybackChange);
    },
  };
};
