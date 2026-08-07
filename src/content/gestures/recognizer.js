import { hitTest, isDragZone, isHoldZone, ZONE } from './zones.js';

const HOLD_DELAY_MS = 350;
const MULTI_TAP_WINDOW_MS = 260;
const MOVE_TOLERANCE_PX = 12;

const MODE = {
  IDLE: 'idle',
  PENDING: 'pending',
  DRAG: 'drag',
  HOLD: 'hold',
  PINCH: 'pinch',
  ABANDONED: 'abandoned',
};

const distanceBetween = (first, second) => {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return Math.hypot(dx, dy);
};

export const createRecognizer = (surface, handlers) => {
  const pointers = new Map();

  let mode = MODE.IDLE;
  let anchor = null;
  let holdTimer = null;
  let tapTimer = null;
  let tapCount = 0;
  let tapZone = ZONE.DEAD;
  let pinchStartDistance = 0;
  let isEnabled = true;

  const emit = (name, detail) => {
    const handler = handlers[name];
    if (handler) handler(detail);
  };

  const localPoint = (event) => {
    const rect = surface.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const clearHoldTimer = () => {
    if (holdTimer === null) return;
    clearTimeout(holdTimer);
    holdTimer = null;
  };

  const flushTaps = () => {
    tapTimer = null;
    if (tapCount === 1) emit('tap', { zone: tapZone });
    else emit('multiTap', { zone: tapZone, count: tapCount });
    tapCount = 0;
  };

  const registerTap = (zone) => {
    // A tap on bare picture acts at once — it only brings the controls up or
    // puts them away. The side boxes have to wait the window out, because a
    // second tap there means "seek", not "show the controls".
    if (zone === ZONE.DEAD) {
      emit('tap', { zone });
      return;
    }
    if (tapZone !== zone) tapCount = 0;
    tapZone = zone;
    tapCount += 1;
    if (tapTimer !== null) clearTimeout(tapTimer);
    tapTimer = setTimeout(flushTaps, MULTI_TAP_WINDOW_MS);
  };

  const startPinch = () => {
    clearHoldTimer();
    if (mode === MODE.DRAG) emit('dragEnd', { zone: anchor.zone });
    if (mode === MODE.HOLD) emit('holdEnd', { zone: anchor.zone });
    const points = Array.from(pointers.values());
    pinchStartDistance = distanceBetween(points[0], points[1]);
    mode = MODE.PINCH;
    emit('pinchStart', {});
  };

  const handleDown = (event) => {
    if (!isEnabled) return;
    surface.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    pointers.set(event.pointerId, point);

    if (pointers.size === 2) {
      startPinch();
      return;
    }
    if (pointers.size > 2) return;

    anchor = {
      x: point.x,
      y: point.y,
      lastX: point.x,
      lastY: point.y,
      zone: hitTest(point.x, point.y, point.width, point.height),
    };
    mode = MODE.PENDING;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      if (mode !== MODE.PENDING || !isHoldZone(anchor.zone)) return;
      mode = MODE.HOLD;
      emit('holdStart', { zone: anchor.zone });
    }, HOLD_DELAY_MS);
  };

  const handlePinchMove = () => {
    const points = Array.from(pointers.values());
    if (points.length < 2) return;
    const spread = distanceBetween(points[0], points[1]);
    if (pinchStartDistance === 0) return;
    emit('pinchMove', { scale: spread / pinchStartDistance });
  };

  const handleMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event);
    pointers.set(event.pointerId, point);

    if (mode === MODE.PINCH) {
      handlePinchMove();
      return;
    }
    if (mode === MODE.ABANDONED || mode === MODE.HOLD) return;

    if (mode === MODE.PENDING) {
      const travelled = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      if (travelled < MOVE_TOLERANCE_PX) return;
      clearHoldTimer();
      if (!isDragZone(anchor.zone)) {
        mode = MODE.ABANDONED;
        return;
      }
      mode = MODE.DRAG;
      emit('dragStart', { zone: anchor.zone, x: anchor.x, y: anchor.y });
    }

    if (mode !== MODE.DRAG) return;
    emit('dragMove', {
      zone: anchor.zone,
      dx: point.x - anchor.lastX,
      dy: point.y - anchor.lastY,
      x: point.x,
      y: point.y,
      width: point.width,
      height: point.height,
    });
    anchor.lastX = point.x;
    anchor.lastY = point.y;
  };

  const handleUp = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);

    if (mode === MODE.PINCH) {
      if (pointers.size >= 2) return;
      emit('pinchEnd', {});
      mode = pointers.size === 0 ? MODE.IDLE : MODE.ABANDONED;
      return;
    }
    if (pointers.size > 0) return;

    clearHoldTimer();
    if (mode === MODE.DRAG) emit('dragEnd', { zone: anchor.zone });
    else if (mode === MODE.HOLD) emit('holdEnd', { zone: anchor.zone });
    else if (mode === MODE.PENDING) registerTap(anchor.zone);
    mode = MODE.IDLE;
  };

  const handleCancel = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    clearHoldTimer();
    if (mode === MODE.DRAG) emit('dragEnd', { zone: anchor.zone });
    if (mode === MODE.HOLD) emit('holdEnd', { zone: anchor.zone });
    if (mode === MODE.PINCH && pointers.size < 2) emit('pinchEnd', {});
    if (pointers.size === 0) mode = MODE.IDLE;
  };

  // Without this, a long press raises the system context menu and Gecko
  // cancels the pointer, which used to drop hold-to-2x after a second or two.
  const blockContextMenu = (event) => event.preventDefault();

  surface.addEventListener('contextmenu', blockContextMenu);
  surface.addEventListener('pointerdown', handleDown);
  surface.addEventListener('pointermove', handleMove);
  surface.addEventListener('pointerup', handleUp);
  surface.addEventListener('pointercancel', handleCancel);

  return {
    setEnabled: (value) => {
      isEnabled = value;
    },
    destroy: () => {
      clearHoldTimer();
      if (tapTimer !== null) clearTimeout(tapTimer);
      surface.removeEventListener('contextmenu', blockContextMenu);
      surface.removeEventListener('pointerdown', handleDown);
      surface.removeEventListener('pointermove', handleMove);
      surface.removeEventListener('pointerup', handleUp);
      surface.removeEventListener('pointercancel', handleCancel);
    },
  };
};
