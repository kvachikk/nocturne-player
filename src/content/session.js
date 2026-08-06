import { createOverlay } from './ui.js';
import { createShadowHost, el, pinStyle } from './shell.js';
import playerCss from './player.css';

const STALL_GRACE_MS = 400;
const EMPTIED_GRACE_MS = 600;
const RECOVER_DELAY_MS = 250;

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

// A site's own player keeps rewriting the video's inline style — YouTube sets
// a pixel width, height and offset on every layout pass — which is what used to
// leave the picture stuck against the left edge or stretched across the screen
// after coming back from another app. Position and offsets are pinned here too,
// not only the size, and re-pinned whenever the site writes over them.
const VIDEO_STYLE = {
  inset: 'auto',
  position: 'relative',
  left: '0',
  top: '0',
  right: 'auto',
  bottom: 'auto',
  float: 'none',
  width: '100%',
  height: '100%',
  'max-width': 'none',
  'max-height': 'none',
  'min-width': '0',
  'min-height': '0',
  margin: '0',
  padding: '0',
  border: '0',
  display: 'block',
  'object-fit': 'contain',
  'object-position': '50% 50%',
  background: '#000',
  'transform-origin': 'center center',
};

const VIDEO_STYLE_KEYS = Object.keys(VIDEO_STYLE);

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

// Written only when it has actually been disturbed, so re-pinning cannot chase
// its own mutation record round in a loop.
const isPinned = (video) =>
  VIDEO_STYLE_KEYS.every(
    (name) =>
      video.style.getPropertyValue(name) === VIDEO_STYLE[name] &&
      video.style.getPropertyPriority(name) === 'important',
  );

// navigationUI is deliberately left at its default. Asking Gecko to hide it put
// Android into sticky immersive mode, where the first swipe up only brings the
// system bars back and a second one is needed to leave the app.
const requestFullscreen = async (element) => {
  if (!document.fullscreenEnabled) return false;
  try {
    await element.requestFullscreen();
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

// Losing fullscreen is how the user leaves the player, and it is also how
// Android announces that it is taking the video into a floating window. The two
// look identical at the moment they happen and only differ a beat later, when
// an app that has gone into the background is no longer the focused one.
const isBackgrounded = () => document.hidden || !document.hasFocus();

export const createSession = (video, { onExit, settings, onPersist }) => {
  const state = captureVideoState(video);
  const anchor = document.createComment('nocturne-player');
  const stage = document.createElement('div');
  const ui = createShadowHost(playerCss);

  const teardown = [];
  const timers = new Set();

  let isActive = false;
  let isOrientationLocked = false;
  let isFullscreenWanted = settings.isFullscreenTakeoverOn;
  let styleGuard = null;
  let overlay = null;
  let relayoutFrame = 0;

  const layers = {
    warm: el('div', { class: 'layer warm' }),
    dim: el('div', { class: 'layer dim' }),
  };

  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    teardown.push(() => target.removeEventListener(type, handler, options));
  };

  const later = (handler, delay) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      handler();
    }, delay);
    timers.add(timer);
    return timer;
  };

  const pinVideo = () => {
    if (isPinned(video)) return;
    pinStyle(video, VIDEO_STYLE);
  };

  const relayout = () => {
    relayoutFrame = 0;
    pinVideo();
    if (overlay) overlay.relayout();
  };

  const scheduleRelayout = () => {
    if (relayoutFrame !== 0) return;
    relayoutFrame = requestAnimationFrame(relayout);
  };

  const mount = () => {
    stage.dataset.nocturnePlayer = '';
    pinStyle(stage, STAGE_STYLE);

    video.replaceWith(anchor);
    video.removeAttribute('controls');
    pinVideo();

    // The site is free to keep laying its player out; it just does not get to
    // move the picture we are showing.
    styleGuard = new MutationObserver(pinVideo);
    styleGuard.observe(video, {
      attributes: true,
      attributeFilter: ['style', 'width', 'height'],
    });

    stage.append(video, ui.host);
    ui.shadow.append(layers.warm, layers.dim);
    document.body.append(stage);
  };

  const unmount = () => {
    if (styleGuard) styleGuard.disconnect();
    styleGuard = null;
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

    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    if (relayoutFrame !== 0) cancelAnimationFrame(relayoutFrame);
    relayoutFrame = 0;

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

  // Gecko keeps a media element playing across a re-parent, but a site shim
  // that reloads it leaves us holding an empty player. A quality switch empties
  // the element too, so the verdict waits until the dust settles.
  const watchForTeardown = () => {
    listen(video, 'emptied', () => {
      later(() => {
        const hasSource = video.currentSrc !== '' || video.srcObject !== null;
        if (hasSource || video.readyState > 0) return;
        console.warn('Nocturne: the video was torn down, backing out');
        exit();
      }, EMPTIED_GRACE_MS);
    });
  };

  const applyLandscape = async () => {
    if (!settings.isAutoLandscapeOn) return;
    const isLocked = await lockLandscape();
    if (isLocked) isOrientationLocked = true;
  };

  const restoreFullscreen = () => {
    if (!isFullscreenWanted) return;
    if (document.fullscreenElement === stage) return;
    // Gecko may refuse this without a fresh gesture. The stage covers the
    // viewport on its own, so the player stays usable either way.
    requestFullscreen(stage).then((isOn) => {
      if (isOn) applyLandscape();
      scheduleRelayout();
    });
  };

  const watchForReturn = () => {
    listen(document, 'fullscreenchange', () => {
      if (document.fullscreenElement === stage) return;
      later(() => {
        if (!isActive) return;
        if (isBackgrounded()) return;
        exit();
      }, RECOVER_DELAY_MS);
    });

    // Coming back from a floating window or from another app: re-take the
    // screen and re-fit the picture to whatever shape it is now.
    listen(document, 'visibilitychange', () => {
      if (document.hidden) return;
      later(() => {
        if (!isActive) return;
        restoreFullscreen();
        scheduleRelayout();
      }, RECOVER_DELAY_MS);
    });

    listen(window, 'resize', scheduleRelayout);
    listen(window, 'orientationchange', scheduleRelayout);
    listen(video, 'loadedmetadata', scheduleRelayout);
    listen(video, 'resize', scheduleRelayout);
  };

  const enter = async () => {
    if (isActive) return false;
    isActive = true;

    watchForTeardown();
    mount();

    overlay = createOverlay({
      video,
      stage,
      shadow: ui.shadow,
      layers,
      onExit: exit,
      settings,
      onPersist,
      onImmersiveChange: (isOn) => {
        isFullscreenWanted = isOn;
        if (isOn) {
          restoreFullscreen();
        } else if (document.fullscreenElement === stage) {
          document.exitFullscreen().catch(() => {});
        }
      },
    });

    later(() => {
      if (state.wasPlaying && video.paused) video.play().catch(() => {});
    }, STALL_GRACE_MS);

    watchForReturn();

    if (isFullscreenWanted) {
      const isOn = await requestFullscreen(stage);
      if (isOn) await applyLandscape();
    }
    scheduleRelayout();
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
