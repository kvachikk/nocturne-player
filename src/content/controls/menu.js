import { el } from '../shell.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SUBTITLE_SCALES = [0.8, 1, 1.25, 1.6];
const SYNC_STEP_SECONDS = 0.5;

const buildChips = (label, options, onSelect) => {
  const chips = options.map((option) =>
    el('button', {
      class: 'chip',
      type: 'button',
      text: option.label,
      'data-id': String(option.id),
    }),
  );

  const row = el('div', { class: 'menu-row' }, [
    el('span', { class: 'menu-label', text: label }),
    el('div', { class: 'chips' }, chips),
  ]);

  const setActive = (id) => {
    for (const chip of chips) {
      const isActive = chip.dataset.id === String(id);
      chip.setAttribute('aria-pressed', String(isActive));
    }
  };

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const raw = chip.dataset.id;
      const id = Number(raw);
      setActive(raw);
      onSelect(Number.isNaN(id) ? raw : id);
    });
  }

  return { row, setActive };
};

const buildStepper = (label, onStep, initial) => {
  const value = el('span', { class: 'step-value', text: initial });
  const minus = el('button', {
    class: 'step-button',
    type: 'button',
    text: '−',
  });
  const plus = el('button', {
    class: 'step-button',
    type: 'button',
    text: '+',
  });

  minus.addEventListener('click', () => {
    value.textContent = onStep(-1);
  });
  plus.addEventListener('click', () => {
    value.textContent = onStep(1);
  });

  return el('div', { class: 'menu-row' }, [
    el('span', { class: 'menu-label', text: label }),
    el('div', { class: 'chips' }, [minus, value, plus]),
  ]);
};

export const createMenu = ({
  video,
  tracks,
  quality,
  onStyle,
  onPickFile,
  onRate,
}) => {
  const speed = buildChips(
    'Speed',
    SPEEDS.map((rate) => ({ id: rate, label: `${rate}x` })),
    (rate) => {
      video.playbackRate = rate;
      onRate(rate);
    },
  );
  speed.setActive(video.playbackRate);

  const subtitleOptions = [{ id: -1, label: 'Off' }, ...tracks.list()];
  const subtitles = buildChips('Subtitles', subtitleOptions, (id) => {
    tracks.select(id);
  });
  subtitles.setActive(tracks.getSelected());

  let scaleIndex = SUBTITLE_SCALES.indexOf(1);
  const sizeRow = buildStepper(
    'Size',
    (direction) => {
      const next = scaleIndex + direction;
      scaleIndex = Math.min(SUBTITLE_SCALES.length - 1, Math.max(0, next));
      const scale = SUBTITLE_SCALES[scaleIndex];
      onStyle({ scale });
      return `${Math.round(scale * 100)}%`;
    },
    '100%',
  );

  const syncRow = buildStepper(
    'Sync',
    (direction) => {
      const next = tracks.getOffset() + direction * SYNC_STEP_SECONDS;
      tracks.setOffset(Number(next.toFixed(1)));
      const offset = tracks.getOffset();
      return `${offset > 0 ? '+' : ''}${offset.toFixed(1)}s`;
    },
    '+0.0s',
  );

  const loadButton = el('button', {
    class: 'chip',
    type: 'button',
    text: 'Load .srt / .vtt',
  });
  loadButton.addEventListener('click', onPickFile);

  const nativeToggle = el('button', {
    class: 'chip',
    type: 'button',
    text: 'Native rendering',
  });
  nativeToggle.addEventListener('click', () => {
    const next = !tracks.isNative();
    tracks.setNative(next);
    nativeToggle.setAttribute('aria-pressed', String(next));
  });

  const qualityRow = quality.isSwitchable()
    ? buildChips('Quality', quality.options, (id) => quality.select(id)).row
    : el('div', { class: 'menu-row' }, [
        el('span', { class: 'menu-label', text: 'Quality' }),
        el('span', { class: 'menu-note', text: quality.describe() }),
      ]);

  const root = el('div', { class: 'panel menu' }, [
    speed.row,
    subtitles.row,
    sizeRow,
    syncRow,
    el('div', { class: 'menu-row' }, [
      el('span', { class: 'menu-label', text: 'Source' }),
      el('div', { class: 'chips' }, [loadButton, nativeToggle]),
    ]),
    qualityRow,
  ]);

  return {
    root,
    toggle: () => root.classList.toggle('is-open'),
    close: () => root.classList.remove('is-open'),
    isOpen: () => root.classList.contains('is-open'),
    setSubtitle: (id) => subtitles.setActive(id),
    refreshSubtitles: (id) => {
      const options = [{ id: -1, label: 'Off' }, ...tracks.list()];
      const rebuilt = buildChips('Subtitles', options, (next) =>
        tracks.select(next),
      );
      subtitles.row.replaceWith(rebuilt.row);
      subtitles.row = rebuilt.row;
      subtitles.setActive = rebuilt.setActive;
      rebuilt.setActive(id);
    },
  };
};
