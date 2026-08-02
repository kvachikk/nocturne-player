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
  { zone: ZONE.PAUSE, center: 0.5, width: 0.22, top: 0.08, bottom: 0.82 },
  { zone: ZONE.HOLD_LEFT, center: 0.23, width: 0.18, top: 0.2, bottom: 0.74 },
  { zone: ZONE.HOLD_RIGHT, center: 0.8, width: 0.18, top: 0.2, bottom: 0.74 },
];

const isInsideBox = (box, x, y, width, height) => {
  const half = (box.width * width) / 2;
  const centerX = box.center * width;
  if (x < centerX - half || x > centerX + half) return false;
  return y >= box.top * height && y <= box.bottom * height;
};

export const hitTest = (x, y, width, height) => {
  if (y >= height - SEEK_BAND_PX) return ZONE.SEEK;

  for (const box of BOXES) {
    if (isInsideBox(box, x, y, width, height)) return box.zone;
  }
  return ZONE.DEAD;
};

export const isDragZone = (zone) => zone === ZONE.SEEK;

export const isHoldZone = (zone) =>
  zone === ZONE.HOLD_LEFT || zone === ZONE.HOLD_RIGHT;
