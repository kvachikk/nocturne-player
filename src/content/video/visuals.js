import { clampPan, clampScale, computeCoverScale, snapScale } from './zoom.js';

const PAUSE_GRAYSCALE = 0.85;
const PAUSE_BRIGHTNESS = 0.7;
const FILTER_TRANSITION = 'filter 350ms ease';
const TRANSFORM_TRANSITION = 'transform 220ms ease';

// Every filter function is always present and always in the same order, so the
// browser can interpolate between two states and the pause fade stays smooth.
const buildFilter = ({ grayscale, saturate, contrast, brightness }) =>
  `grayscale(${grayscale}) saturate(${saturate}) ` +
  `contrast(${contrast}) brightness(${brightness})`;

export const createVisuals = (video, stage) => {
  const colour = { saturate: 1, contrast: 1, brightness: 1 };
  const view = { scale: 1, x: 0, y: 0 };

  let isPaused = video.paused;
  let isPinching = false;

  const apply = () => {
    const filter = buildFilter({
      grayscale: isPaused ? PAUSE_GRAYSCALE : 0,
      saturate: colour.saturate,
      contrast: colour.contrast,
      brightness: colour.brightness * (isPaused ? PAUSE_BRIGHTNESS : 1),
    });
    const offset = `translate(${view.x}px, ${view.y}px)`;
    const transform = `${offset} scale(${view.scale})`;
    const transition = isPinching
      ? FILTER_TRANSITION
      : `${FILTER_TRANSITION}, ${TRANSFORM_TRANSITION}`;

    video.style.setProperty('filter', filter, 'important');
    video.style.setProperty('transform', transform, 'important');
    video.style.setProperty('transition', transition, 'important');
  };

  const stageSize = () => {
    const rect = stage.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };

  const setScale = (scale) => {
    const size = stageSize();
    const cover = computeCoverScale(
      video.videoWidth,
      video.videoHeight,
      size.width,
      size.height,
    );
    view.scale = snapScale(clampScale(scale), [1, cover]);
    const pan = clampPan(view.x, view.y, view.scale, size.width, size.height);
    view.x = pan.x;
    view.y = pan.y;
    apply();
    return view.scale;
  };

  apply();

  return {
    setPaused: (value) => {
      isPaused = value;
      apply();
    },
    setColour: (patch) => {
      Object.assign(colour, patch);
      apply();
    },
    getColour: () => ({ ...colour }),
    beginPinch: () => {
      isPinching = true;
      return view.scale;
    },
    pinchTo: (scale) => setScale(scale),
    endPinch: () => {
      isPinching = false;
      return setScale(view.scale);
    },
    reset: () => {
      view.x = 0;
      view.y = 0;
      return setScale(1);
    },
    getScale: () => view.scale,
  };
};
