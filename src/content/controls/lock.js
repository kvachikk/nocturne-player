import { el } from '../shell.js';

const PILL_TIMEOUT_MS = 5000;
const UNLOCK_TRAVEL_RATIO = 0.7;

const buildLockIcon = () =>
  el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
    el('path', { d: 'M8 10V7a4 4 0 0 1 8 0v3M6 10h12v9H6z' }),
  ]);

// Locking has to survive a palm resting on the screen, so unlocking takes two
// deliberate acts: a tap to reveal the pill, then a swipe across it.
export const createLock = (onUnlock) => {
  const knob = el('div', { class: 'lock-knob' }, [buildLockIcon()]);
  const pill = el('div', { class: 'lock-pill' }, [
    knob,
    el('span', { class: 'lock-label', text: 'swipe to unlock' }),
  ]);
  const veil = el('div', { class: 'layer lock-veil' }, [pill]);

  let hideTimer = null;
  let pointerId = null;
  let startX = 0;

  const hidePill = () => {
    hideTimer = null;
    pill.classList.remove('is-shown');
  };

  const revealPill = () => {
    pill.classList.add('is-shown');
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePill, PILL_TIMEOUT_MS);
  };

  const resetKnob = () => {
    knob.style.transform = '';
    pointerId = null;
  };

  veil.addEventListener('pointerdown', (event) => {
    if (!pill.classList.contains('is-shown')) {
      revealPill();
      return;
    }
    if (!knob.contains(event.target)) {
      revealPill();
      return;
    }
    pointerId = event.pointerId;
    startX = event.clientX;
    veil.setPointerCapture(pointerId);
  });

  veil.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    const travel = Math.max(0, event.clientX - startX);
    const limit = pill.getBoundingClientRect().width * UNLOCK_TRAVEL_RATIO;
    knob.style.transform = `translateX(${Math.min(travel, limit)}px)`;
    if (travel < limit) return;
    resetKnob();
    hidePill();
    veil.classList.remove('is-active');
    onUnlock();
  });

  const cancelDrag = (event) => {
    if (pointerId !== event.pointerId) return;
    resetKnob();
    revealPill();
  };

  veil.addEventListener('pointerup', cancelDrag);
  veil.addEventListener('pointercancel', cancelDrag);

  return {
    veil,
    engage: () => {
      veil.classList.add('is-active');
      revealPill();
    },
    release: () => {
      veil.classList.remove('is-active');
      hidePill();
      resetKnob();
    },
    destroy: () => {
      if (hideTimer !== null) clearTimeout(hideTimer);
    },
  };
};
