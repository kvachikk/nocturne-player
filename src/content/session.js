import { createOverlay } from './ui.js';
import { createShadowHost, el, pinStyle } from './shell.js';
import playerCss from './player.css';

const STALL_GRACE_MS = 400;

const STAGE_STYLE = {
  position: 'fixed',
  inset: '0',
  width: '100vw',
  height: '100vh',
  margin: '0',
  padding: '0',
  border: '0',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  overflow: 'hidden',
  background: '#000',
  'z-index': '2147483646',
};

const VIDEO_STYLE = {
  width: '100%',
  height: '100%',
  'max-width': 'none',
  'max-height': 'none',
  'min-width': '0',
  'min-height': '0',
  margin: '0',
  padding: '0',
  display: 'block',
  'object-fit': 'contain',
  background: '#000',
  'transform-origin': 'center center',
};

const captureVideoState = (video) => ({
  cssText: video.style.cssText,
  hasControlsAttribute: video.hasAttribute('controls'),
  playbackRate: video.playbackRate,
  volume: video.volume,
  isMuted: video.muted,
  wasPlaying: !video.paused,
  parent: video.parentNode,
  nextSibling: video.nextSibling,
});

const restoreVideoState = (video, state) => {
  video.style.cssText = state.cssText;
  if (state.hasControlsAttribute) video.setAttribute('controls', '');
  else video.removeAttribute('controls');
  video.playbackRate = state.playbackRate;
  video.volume = state.volume;
  video.muted = state.isMuted;
};

const auditRestore = (video, state) => {
  const isSameParent = video.parentNode === state.parent;
  const isSameSibling = video.nextSibling === state.nextSibling;
  if (isSameParent && isSameSibling) return true;
  console.warn('Nocturne: video was not restored to its original position', {
    isSameParent,
    isSameSibling,
  });
  return false;
};

const requestFullscreen = async (element) => {
  if (!document.fullscreenEnabled) return false;
  try {
    await element.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch (error) {
    console.warn('Nocturne: fullscreen refused', error);
    return false;
  }
};

const lockLandscape = async () => {
  try {
    await screen.orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
};

const unlockOrientation = () => {
  try {
    screen.orientation.unlock();
  } catch {
    // Never surfaced: the lock is a nicety, not a requirement.
  }
};

export const createSession = (video, { onExit, settings, onPersist }) => {
  const state = captureVideoState(video);
  const anchor = document.createComment('nocturne-player');
  const stage = document.createElement('div');
  const ui = createShadowHost(playerCss);

  const teardown = [];

  let isActive = false;
  let isOrientationLocked = false;
  let stallTimer = null;
  let overlay = null;

  const layers = {
    warm: el('div', { class: 'layer warm' }),
    dim: el('div', { class: 'layer dim' }),
  };

  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    teardown.push(() => target.removeEventListener(type, handler, options));
  };

  const mount = () => {
    stage.dataset.nocturnePlayer = '';
    pinStyle(stage, STAGE_STYLE);

    video.replaceWith(anchor);
    video.removeAttribute('controls');
    pinStyle(video, VIDEO_STYLE);

    stage.append(video, ui.host);
    ui.shadow.append(layers.warm, layers.dim);
    document.body.append(stage);
  };

  const unmount = () => {
    if (overlay) overlay.destroy();
    overlay = null;
    stage.remove();
    restoreVideoState(video, state);
    if (anchor.isConnected) anchor.replaceWith(video);
    auditRestore(video, state);
  };

  const exit = () => {
    if (!isActive) return;
    isActive = false;

    if (stallTimer !== null) clearTimeout(stallTimer);
    stallTimer = null;

    for (const undo of teardown) undo();
    teardown.length = 0;

    if (isOrientationLocked) unlockOrientation();
    isOrientationLocked = false;

    if (document.fullscreenElement === stage) {
      document.exitFullscreen().catch(() => {});
    }

    unmount();
    onExit();
  };

  const enter = async () => {
    if (isActive) return false;
    isActive = true;

    // Gecko keeps a media element playing across a re-parent, but if some site
    // shim reloads it we back out rather than leave the page in a broken state.
    listen(video, 'emptied', () => {
      console.warn('Nocturne: the video reloaded when moved, backing out');
      exit();
    });

    mount();
    overlay = createOverlay({
      video,
      stage,
      shadow: ui.shadow,
      layers,
      onExit: exit,
      settings,
      onPersist,
      wasPlaying: state.wasPlaying,
    });

    stallTimer = setTimeout(() => {
      stallTimer = null;
      if (state.wasPlaying && video.paused) video.play().catch(() => {});
    }, STALL_GRACE_MS);

    listen(document, 'fullscreenchange', () => {
      if (document.fullscreenElement !== stage) exit();
    });

    await requestFullscreen(stage);
    isOrientationLocked = await lockLandscape();
    return true;
  };

  return {
    enter,
    exit,
    video,
    stage,
    shadow: ui.shadow,
    layers,
    isActive: () => isActive,
  };
};
