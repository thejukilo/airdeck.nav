import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

/**
 * Makes a floating panel draggable by a handle. On first layout it captures the
 * panel's current (CSS-anchored) screen position, then switches to absolute
 * left/top so dragging is conflict-free with centering transforms. Pointer
 * based, so it works with touch on tablets.
 *
 * Usage:
 *   const { ref, style, handleProps } = useDraggable();
 *   <div className="panel" ref={ref} style={style}>
 *     <div {...handleProps}>…drag handle…</div>
 *   </div>
 */
export function useDraggable() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Capture the initial CSS-anchored position once, in screen pixels.
  useLayoutEffect(() => {
    if (pos === null && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ x: r.left, y: r.top });
    }
  }, [pos]);

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (!ref.current) return;
    // Don't start a drag when pressing an interactive control in the handle.
    if ((e.target as HTMLElement).closest("button, input, a, select")) return;
    const r = ref.current.getBoundingClientRect();
    start.current = { px: e.clientX, py: e.clientY, ox: r.left, oy: r.top };

    const move = (ev: globalThis.PointerEvent) => {
      const s = start.current;
      if (!s || !ref.current) return;
      const w = ref.current.offsetWidth;
      const h = ref.current.offsetHeight;
      const x = Math.max(4, Math.min(window.innerWidth - w - 4, s.ox + ev.clientX - s.px));
      const y = Math.max(4, Math.min(window.innerHeight - h - 4, s.oy + ev.clientY - s.py));
      setPos({ x, y });
    };
    const up = () => {
      start.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  }, []);

  const style: CSSProperties | undefined = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", transform: "none", margin: 0 }
    : undefined;

  const handleProps = {
    onPointerDown,
    style: { cursor: "grab", touchAction: "none" } as CSSProperties,
  };

  return { ref, style, handleProps };
}
