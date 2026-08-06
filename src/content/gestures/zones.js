export const ZONE = {
  SEEK: 'seek',
  HOLD_LEFT: 'holdLeft',
  HOLD_RIGHT: 'holdRight',
  DEAD: 'dead',
};

// Every gesture target is a bounded box with dead space around it. A thumb that
// lands off-target does nothing at all, which is the only way to stop the
// player from acting on a touch that was never meant for it.
//
// The bottom fifth of the screen belongs to Android: that is where the home
// swipe starts, and a seek band reaching into it turned "put the app away" into
// "jump to the middle of the film". Everything of ours stays above it.
const SEEK_TOP = 0.72;
const SEEK_BOTTOM = 0.88;

const BOXES = [
  { zone: ZONE.HOLD_LEFT, center: 0.23, width: 0.18, top: 0.18, bottom: 0.56 },
  { zone: ZONE.HOLD_RIGHT, center: 0.8, width: 0.18, top: 0.18, bottom: 0.56 },
];

const isInsideBox = (box, x, y, width, height) => {
  const half = (box.width * width) / 2;
  const centerX = box.center * width;
  if (x < centerX - half || x > centerX + half) return false;
  return y >= box.top * height && y <= box.bottom * height;
};

// Pausing is not a zone any more. It is the play button and nothing else, so a
// tap on the picture can only ever bring the controls up or put them away.
export const hitTest = (x, y, width, height) => {
  if (y >= SEEK_TOP * height && y <= SEEK_BOTTOM * height) return ZONE.SEEK;

  for (const box of BOXES) {
    if (isInsideBox(box, x, y, width, height)) return box.zone;
  }
  return ZONE.DEAD;
};

export const isDragZone = (zone) => zone === ZONE.SEEK;

export const isHoldZone = (zone) =>
  zone === ZONE.HOLD_LEFT || zone === ZONE.HOLD_RIGHT;
