import { el } from '../shell.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SUBTITLE_SCALES = [0.8, 1, 1.25, 1.6];
const SYNC_STEP_SECONDS = 0.5;

// A row of chips whose contents are repainted rather than rebuilt, because a
// streaming site only learns what it can offer after the film has started and
// the sheet has to be able to say so the next time it opens.
const buildChipRow = (label) => {
  const chips = el('div', { class: 'chips' });
  const row = el('div', { class: 'menu-row' }, [
    el('span', { class: 'menu-label', text: label }),
    chips,
  ]);
  return { row, chips };
};

const paintChips = (holder, options, onSelect) => {
  const chips = options.map((option) =>
    el('button', {
      class: 'chip',
      type: 'button',
      text: option.label,
      'data-id': String(option.id),
    }),
  );

  const setActive = (id) => {
    for (const chip of chips) {
      chip.setAttribute('aria-pressed', String(chip.dataset.id === String(id)));
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

  holder.chips.replaceChildren(...chips);
  return setActive;
};

const buildNote = (text) => el('span', { class: 'menu-note', text });

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

const buildToggle = (label, isOn, onToggle) => {
  const chip = el('button', { class: 'chip', type: 'button', text: label });
  chip.setAttribute('aria-pressed', String(isOn));
  chip.addEventListener('click', () => {
    const next = chip.getAttribute('aria-pressed') !== 'true';
    chip.setAttribute('aria-pressed', String(next));
    onToggle(next);
  });
  return chip;
};

export const createMenu = ({
  video,
  tracks,
  quality,
  onStyle,
  onPickFile,
  onRate,
  onImmersive,
  onNotice,
}) => {
  const speedRow = buildChipRow('Speed');
  const setSpeed = paintChips(
    speedRow,
    SPEEDS.map((rate) => ({ id: rate, label: `${rate}x` })),
    (rate) => {
      video.playbackRate = rate;
      onRate(rate);
    },
  );
  setSpeed(video.playbackRate);

  const subtitleRow = buildChipRow('Subtitles');
  let setSubtitle = () => {};

  const paintSubtitles = () => {
    const options = [{ id: -1, label: 'Off' }, ...tracks.list()];
    setSubtitle = paintChips(subtitleRow, options, (id) => tracks.select(id));
    setSubtitle(tracks.getSelected());
  };

  const qualityRow = buildChipRow('Quality');

  // The site keeps the ladder; all we do is ask for a rung. When there is no
  // way in, the row says what is playing instead of pretending to offer a
  // choice that would do nothing.
  const paintQuality = () => {
    quality.refresh();
    const options = quality.getOptions();
    if (options.length === 0) {
      qualityRow.chips.replaceChildren(buildNote(quality.describe()));
      return;
    }
    const setQuality = paintChips(qualityRow, options, (id) => {
      // Only the refusal is worth a word. The chip lighting up already says
      // the choice was taken, and a message over the film for every tap is
      // noise the viewer did not ask for.
      if (!quality.select(id)) onNotice('The site would not change it');
    });
    setQuality(quality.getCurrent());
  };

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

  const nativeToggle = buildToggle('Native', tracks.isNative(), () => {
    tracks.setNative(!tracks.isNative());
  });

  const immersiveToggle = buildToggle('Fullscreen', true, onImmersive);

  paintSubtitles();
  qualityRow.chips.replaceChildren(buildNote('Reading the site…'));

  // Quality leads. It is the row people open this sheet for, it is the longest,
  // and on a phone held sideways the sheet scrolls — so anything below the
  // first two rows is a row somebody has to go looking for.
  const root = el('div', { class: 'panel menu' }, [
    qualityRow.row,
    speedRow.row,
    subtitleRow.row,
    sizeRow,
    syncRow,
    el('div', { class: 'menu-row' }, [
      el('span', { class: 'menu-label', text: 'Source' }),
      el('div', { class: 'chips' }, [loadButton, nativeToggle]),
    ]),
    el('div', { class: 'menu-row' }, [
      el('span', { class: 'menu-label', text: 'Screen' }),
      el('div', { class: 'chips' }, [immersiveToggle]),
    ]),
  ]);

  // Both lists can grow while the film plays — a caption track switched on in
  // the site's own player, a quality ladder that finished loading — so they are
  // read again every time the sheet is opened.
  const refresh = () => {
    paintSubtitles();
    paintQuality();
  };

  const open = () => {
    refresh();
    root.classList.add('is-open');
    // Opened at the top, always. The sheet scrolls, and a chip that still has
    // focus from the last time drags the view down to itself, which hides the
    // row the sheet was opened for.
    root.scrollTop = 0;
  };

  return {
    root,
    refresh,
    open,
    toggle: () => {
      if (root.classList.contains('is-open')) root.classList.remove('is-open');
      else open();
    },
    close: () => root.classList.remove('is-open'),
    isOpen: () => root.classList.contains('is-open'),
    setSubtitle: (id) => setSubtitle(id),
  };
};
