import { formatClock, formatRemaining } from '../../lib/time.js';
import { el } from '../shell.js';

const PREVIEW_INTERVAL_MS = 120;

// Pull the finger away from the bar and the same swipe covers less time, so a
// two-hour film can be landed on the exact scene.
const PRECISION_STEPS = [
  { withinPx: 40, factor: 1 },
  { withinPx: 100, factor: 0.5 },
  { withinPx: 180, factor: 0.25 },
  { withinPx: Infinity, factor: 0.1 },
];

const precisionFor = (distancePx) => {
  for (const step of PRECISION_STEPS) {
    if (distancePx <= step.withinPx) return step;
  }
  return PRECISION_STEPS[PRECISION_STEPS.length - 1];
};

export const createSeekBar = (video) => {
  const elapsed = el('span', { class: 'time', text: '0:00' });
  const remaining = el('span', { class: 'time', text: '--:--' });
  const fill = el('div', { class: 'seek-fill' });
  const track = el('div', { class: 'seek-track' }, [fill]);
  const headTime = el('span', { class: 'seek-time', text: '0:00' });
  const area = el('div', { class: 'seek-area' }, [track, headTime]);
  const root = el('div', { class: 'seekbar' }, [
    el('div', { class: 'seek-row' }, [elapsed, area, remaining]),
  ]);

  let isScrubbing = false;
  let scrubTime = 0;
  let lastPreviewAt = 0;

  const duration = () => (Number.isFinite(video.duration) ? video.duration : 0);

  // While scrubbing the left label holds the moment the drag started, so the
  // target time on the line is not simply repeated back to the user and they
  // can see where to return to.
  const paint = (time) => {
    const total = duration();
    const ratio = total > 0 ? Math.min(1, Math.max(0, time / total)) : 0;
    fill.style.transform = `scaleX(${ratio})`;
    area.style.setProperty('--progress', `${ratio * 100}%`);
    headTime.textContent = formatClock(time);
    remaining.textContent = formatRemaining(time, video.duration);
    if (!isScrubbing) elapsed.textContent = formatClock(time);
  };

  const sync = () => {
    if (isScrubbing) return;
    paint(video.currentTime);
  };

  const start = () => {
    scrubTime = video.currentTime;
    lastPreviewAt = 0;
    elapsed.textContent = formatClock(scrubTime);
    isScrubbing = true;
    root.classList.add('is-scrubbing');
  };

  // Measured rather than assumed: the bar sits a fifth of the way up the
  // screen, and where exactly that lands depends on the phone.
  const barCenter = (fallback) => {
    const rect = track.getBoundingClientRect();
    if (rect.height === 0) return fallback;
    return rect.top + rect.height / 2;
  };

  const move = ({ dx, y, width, height }) => {
    const total = duration();
    if (total === 0) return;

    const step = precisionFor(Math.abs(y - barCenter(height)));
    scrubTime += (dx / width) * total * step.factor;
    scrubTime = Math.min(total, Math.max(0, scrubTime));
    paint(scrubTime);

    const now = performance.now();
    if (now - lastPreviewAt < PREVIEW_INTERVAL_MS) return;
    lastPreviewAt = now;
    video.currentTime = scrubTime;
  };

  const end = () => {
    if (!isScrubbing) return;
    isScrubbing = false;
    root.classList.remove('is-scrubbing');
    if (duration() > 0) video.currentTime = scrubTime;
    paint(scrubTime);
  };

  video.addEventListener('timeupdate', sync);
  video.addEventListener('durationchange', sync);
  video.addEventListener('seeked', sync);
  sync();

  return {
    root,
    start,
    move,
    end,
    destroy: () => {
      video.removeEventListener('timeupdate', sync);
      video.removeEventListener('durationchange', sync);
      video.removeEventListener('seeked', sync);
    },
  };
};
