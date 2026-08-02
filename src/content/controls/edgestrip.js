import { el } from '../shell.js';

const TRAVEL_RATIO = 0.6;

// A full sweep of the strip covers the whole range over 60% of the screen
// height, which is about as far as a thumb reaches without regripping.
export const createEdgeStrip = ({ side, topGlyph, bottomGlyph, onChange }) => {
  const fill = el('div', { class: 'strip-fill' });
  const track = el('div', { class: 'strip-track' }, [fill]);
  const root = el('div', { class: `strip strip-${side}` }, [
    el('span', { class: 'strip-glyph', text: topGlyph }),
    track,
    el('span', { class: 'strip-glyph', text: bottomGlyph }),
  ]);

  let value = 0;

  const paint = () => {
    fill.style.transform = `scaleY(${value})`;
  };

  const set = (next) => {
    value = Math.min(1, Math.max(0, next));
    paint();
    return value;
  };

  return {
    root,
    set,
    getValue: () => value,
    start: () => root.classList.add('is-active'),
    move: ({ dy, height }) => {
      const travel = height * TRAVEL_RATIO;
      onChange(set(value - dy / travel));
    },
    end: () => root.classList.remove('is-active'),
  };
};
