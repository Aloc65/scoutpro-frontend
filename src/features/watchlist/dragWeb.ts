import { Platform } from 'react-native';

export const IS_WEB = Platform.OS === 'web';

export interface GlobalDragCallbacks {
  /**
   * Fired once the pointer has moved past the threshold, i.e. a real drag has
   * begun. `id` is the value of the data-* attribute on the pressed element.
   * Coordinates are in viewport space (clientX/clientY) so they line up with
   * measureInWindow() and getBoundingClientRect().
   */
  onStart: (id: string, x: number, y: number, grabX: number, grabY: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: (x: number, y: number) => void;
  /** Fired when the pointer is released without ever crossing the threshold. */
  onTap: (id: string) => void;
}

/**
 * Attach a robust, single global pointer-based drag controller (web only).
 *
 * WHY A GLOBAL WINDOW LISTENER (and not one per card):
 * react-native-web runs its own synthetic event system that stops native DOM
 * event propagation at its root container. A `pointerdown` listener attached to
 * an individual card's DOM node therefore NEVER fires — in either the capture
 * or bubble phase — because RNW swallows the event above the card node. The
 * only place a native listener reliably fires is `window`. So we register ONE
 * capture-phase pointerdown listener on window and hit-test which card/handle
 * was pressed using a `data-*` attribute (rendered via RNW's `dataSet` prop).
 *
 * WHY NO setPointerCapture: react-native-web keeps pointer capture alive across
 * gestures in some cases, which routes every subsequent pointer event to the
 * previously-dragged node (grabbing card A would then drag card B). We instead
 * track the gesture with window-level move/up listeners for its duration and
 * tear them down on release, so there is no capture leakage.
 *
 * @param attr  camelCase dataset key, e.g. 'dragcard' matches data-dragcard.
 * Returns a cleanup function that removes every listener.
 */
export function attachGlobalDrag(
  attr: string,
  cbs: GlobalDragCallbacks,
  threshold = 6,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const selector = `[data-${attr}]`;

  let currentId: string | null = null;
  let startX = 0;
  let startY = 0;
  let grabX = 0;
  let grabY = 0;
  let dragging = false;
  let active = false;
  let pointerId: number | null = null;

  const setBodySelect = (on: boolean) => {
    try {
      const v = on ? 'none' : '';
      document.body.style.userSelect = v;
      (document.body.style as any).webkitUserSelect = v;
    } catch {
      /* noop */
    }
  };

  const removeWindowListeners = () => {
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
  };

  const finish = () => {
    active = false;
    dragging = false;
    pointerId = null;
    currentId = null;
    removeWindowListeners();
    setBodySelect(false);
  };

  const onMove = (e: PointerEvent) => {
    if (!active || (pointerId != null && e.pointerId !== pointerId)) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
      dragging = true;
      setBodySelect(true);
      if (currentId != null) cbs.onStart(currentId, e.clientX, e.clientY, grabX, grabY);
    }
    if (dragging) {
      e.preventDefault();
      cbs.onMove(e.clientX, e.clientY);
    }
  };

  const onUp = (e: PointerEvent) => {
    if (!active || (pointerId != null && e.pointerId !== pointerId)) return;
    const wasDragging = dragging;
    const id = currentId;
    const x = e.clientX;
    const y = e.clientY;
    finish();
    if (wasDragging) cbs.onEnd(x, y);
    else if (id != null) cbs.onTap(id);
  };

  const onCancel = (e: PointerEvent) => {
    if (!active || (pointerId != null && e.pointerId !== pointerId)) return;
    const wasDragging = dragging;
    finish();
    if (wasDragging) cbs.onEnd(startX, startY);
  };

  const findDraggable = (e: PointerEvent): HTMLElement | null => {
    // Prefer a geometric hit-test: react-native-web sometimes reports e.target
    // as an internal text/selection node whose ancestor chain does NOT include
    // our card wrapper, even though the card is visually there. elementFromPoint
    // returns the topmost painted element at the cursor, whose .closest() walks
    // up to the data-* wrapper reliably. We fall back to e.target just in case.
    const byPoint = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    if (byPoint && typeof byPoint.closest === 'function') {
      const hit = byPoint.closest(selector) as HTMLElement | null;
      if (hit) return hit;
    }
    const target = e.target as Element | null;
    if (target && typeof target.closest === 'function') {
      return target.closest(selector) as HTMLElement | null;
    }
    return null;
  };

  const onDown = (e: PointerEvent) => {
    if (active) return; // ignore secondary pointers mid-drag
    if (e.button != null && e.button !== 0) return; // primary button only
    const el = findDraggable(e);
    if (!el) return; // press was not on a draggable element
    const id = el.dataset[attr];
    if (id == null) return;

    const rect = el.getBoundingClientRect();
    currentId = id;
    startX = e.clientX;
    startY = e.clientY;
    grabX = e.clientX - rect.left;
    grabY = e.clientY - rect.top;
    dragging = false;
    active = true;
    pointerId = e.pointerId;

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
  };

  // Capture phase on window: the one place RNW cannot swallow the event before
  // we see it.
  window.addEventListener('pointerdown', onDown, true);

  return () => {
    window.removeEventListener('pointerdown', onDown, true);
    finish();
  };
}
