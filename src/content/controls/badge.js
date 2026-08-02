import { createShadowHost, el, pinStyle } from '../shell.js';
import badgeCss from './badge.css';

const SIZE_PX = 44;
const INSET_PX = 12;
const MIN_VISIBLE_RATIO = 0.35;

const buildButton = () =>
  el(
    'button',
    { class: 'badge', type: 'button', title: 'Open in Nocturne Player' },
    [
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
    ],
  );

export const createBadge = () => {
  const shell = createShadowHost(badgeCss, {
    width: `${SIZE_PX}px`,
    height: `${SIZE_PX}px`,
    'pointer-events': 'auto',
  });

  const button = buildButton();
  shell.shadow.append(button);
  let target = null;
  let frame = 0;
  let isMounted = false;

  const isMostlyVisible = (rect) => {
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);
    const visible = Math.max(0, visibleBottom - visibleTop);
    return visible / rect.height >= MIN_VISIBLE_RATIO;
  };

  const conceal = () => {
    pinStyle(shell.host, { opacity: '0', 'pointer-events': 'none' });
  };

  // Teardown is the watcher's job: when the video goes away it reports a new
  // primary and calls hide(). Here we only stop drawing.
  const reposition = () => {
    frame = 0;
    if (!target?.isConnected) {
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
      left: `${rect.right - SIZE_PX - INSET_PX}px`,
      top: `${rect.bottom - SIZE_PX - INSET_PX}px`,
    });
  };

  const scheduleReposition = () => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(reposition);
  };

  const show = (video) => {
    target = video;
    if (!isMounted) {
      document.body.append(shell.host);
      window.addEventListener('scroll', scheduleReposition, true);
      window.addEventListener('resize', scheduleReposition);
      isMounted = true;
    }
    reposition();
  };

  const hide = () => {
    target = null;
    if (!isMounted) return;
    window.removeEventListener('scroll', scheduleReposition, true);
    window.removeEventListener('resize', scheduleReposition);
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    shell.host.remove();
    isMounted = false;
  };

  const api = { show, hide, refresh: scheduleReposition, onActivate: null };

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (target && api.onActivate) api.onActivate(target);
  });

  return api;
};
