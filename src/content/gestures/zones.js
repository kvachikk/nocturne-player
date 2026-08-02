export const ZONE = {
  SEEK: 'seek',
  PAUSE: 'pause',
  HOLD_LEFT: 'holdLeft',
  HOLD_RIGHT: 'holdRight',
  DEAD: 'dead',
};

// Bounded targets with dead space between them: a thumb landing off-target
// does nothing rather than triggering the nearest control.
const SEEK_BAND_PX = 72;

const BOXES = [
  { zone: ZONE.HOLD_LEFT, center: 0.23, width: 0.18, top: 0.2, bottom: 0.74 },
  { zone: ZONE.HOLD_RIGHT, center: 0.8, width: 0.18, top: 0.2, bottom: 0.74 },
];

const isInsideBox = (box, x, y, width, height) => {
  const half = (box.width * width) / 2;
  const centerX = box.center * width;
  if (x < centerX - half || x > centerX + half) return false;
  return y >= box.top * height && y <= box.bottom * height;
};

// Pause is the fallback rather than a box of its own: it is the hidden button
// the whole picture acts as, so it cannot be missed.
export const hitTest = (x, y, width, height) => {
  if (y >= height - SEEK_BAND_PX) return ZONE.SEEK;

  for (const box of BOXES) {
    if (isInsideBox(box, x, y, width, height)) return box.zone;
  }
  return ZONE.PAUSE;
};

export const isDragZone = (zone) => zone === ZONE.SEEK;

export const isHoldZone = (zone) =>
  zone === ZONE.HOLD_LEFT || zone === ZONE.HOLD_RIGHT;
