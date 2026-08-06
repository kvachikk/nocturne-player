import { createShadowHost, el, pinStyle } from '../shell.js';
import badgeCss from './badge.css';

const SIZE_PX = 44;
const GAP_PX = 10;
const STACK_HEIGHT_PX = SIZE_PX * 2 + GAP_PX;
const INSET_PX = 12;
const MIN_VISIBLE_RATIO = 0.35;
const IDLE_MS = 3200;

const buildOpenButton = () =>
  el('button', { class: 'badge', type: 'button', title: 'Open in Nocturne' }, [
    el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
      el('path', {
        d: 'M8 6.5 17 12l-9 5.5z',
        fill: 'rgba(244,241,255,0.92)',
      }),
      el('path', {
        d: 'M20.5 3.2a3.2 3.2 0 1 0 .6 5.9 3.6 3.6 0 0 1-.6-5.9z',
        fill: 'rgba(244,241,255,0.5)',
      }),
    ]),
  ]);

// The site's own fullscreen button is often tiny, buried in a control bar, or
// missing altogether. This one is for the film you are already watching in the
// little window and simply want bigger.
const buildExpandButton = () =>
  el('button', { class: 'badge expand', type: 'button', title: 'Fullscreen' }, [
    el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
      el('path', { d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' }),
    ]),
  ]);

export const createBadge = () => {
  const shell = createShadowHost(badgeCss, {
    width: `${SIZE_PX}px`,
    height: `${STACK_HEIGHT_PX}px`,
    'pointer-events': 'auto',
  });

  const openButton = buildOpenButton();
  const expandButton = buildExpandButton();
  shell.shadow.append(
    el('div', { class: 'stack' }, [openButton, expandButton]),
  );

  let target = null;
  let frame = 0;
  let isMounted = false;
  let isAwake = true;
  let idleTimer = null;

  const isMostlyVisible = (rect) => {
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);
    const visible = Math.max(0, visibleBottom - visibleTop);
    return visible / rect.height >= MIN_VISIBLE_RATIO;
  };

  const conceal = () => {
    pinStyle(shell.host, { opacity: '0', 'pointer-events': 'none' });
  };

  // Halfway up the right edge, which is the one part of a video that no player
  // puts a control on: the bottom corner sat on top of the site's own buttons
  // and swallowed taps meant for them.
  const placement = (rect) => {
    const left = rect.right - SIZE_PX - INSET_PX;
    const top = rect.top + rect.height / 2 - STACK_HEIGHT_PX / 2;
    const maxTop = window.innerHeight - STACK_HEIGHT_PX - INSET_PX;
    return {
      left: `${Math.max(INSET_PX, left)}px`,
      top: `${Math.min(maxTop, Math.max(INSET_PX, top))}px`,
    };
  };

  // Teardown is the watcher's job: when the video goes away it reports a new
  // primary and calls hide(). Here we only stop drawing.
  const reposition = () => {
    frame = 0;
    if (!target?.isConnected || !isAwake) {
      conceal();
      return;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || !isMostlyVisible(rect)) {
      conceal();
      return;
    }
    pinStyle(shell.host, {
      opacity: '1',
      'pointer-events': 'auto',
      ...placement(rect),
    });
  };

  const scheduleReposition = () => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(reposition);
  };

  // Two buttons parked on somebody's video are two buttons in the way, so they
  // step aside when nothing has happened for a moment and come back on the next
  // touch anywhere on the page.
  const sleep = () => {
    idleTimer = null;
    isAwake = false;
    scheduleReposition();
  };

  const wake = () => {
    isAwake = true;
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = setTimeout(sleep, IDLE_MS);
    scheduleReposition();
  };

  const show = (video) => {
    target = video;
    if (!isMounted) {
      document.body.append(shell.host);
      window.addEventListener('scroll', scheduleReposition, true);
      window.addEventListener('resize', scheduleReposition);
      document.addEventListener('pointerdown', wake, true);
      isMounted = true;
    }
    wake();
  };

  const hide = () => {
    target = null;
    if (!isMounted) return;
    window.removeEventListener('scroll', scheduleReposition, true);
    window.removeEventListener('resize', scheduleReposition);
    document.removeEventListener('pointerdown', wake, true);
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = null;
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    shell.host.remove();
    isMounted = false;
  };

  const api = {
    show,
    hide,
    refresh: scheduleReposition,
    onActivate: null,
    onExpand: null,
  };

  const wire = (button, name) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      wake();
      if (target && api[name]) api[name](target);
    });
  };

  wire(openButton, 'onActivate');
  wire(expandButton, 'onExpand');

  return api;
};
