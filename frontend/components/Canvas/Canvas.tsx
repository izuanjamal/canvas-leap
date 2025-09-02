import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useCanvasStore } from "../../state/canvasStore";
import { screenToWorld } from "../../utils/transform";
import { Background } from "./Background";
import { ElementLayer } from "./ElementLayer";
import { CursorLayer } from "./CursorLayer";
import { useBoardSocket } from "../../contexts/BoardSocketProvider";

// Simple throttle util
function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: any = null;
  let lastArgs: any[] | null = null;
  const run = () => {
    last = Date.now();
    timer = null;
    if (lastArgs) {
      fn(...(lastArgs as any));
      lastArgs = null;
    }
  };
  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      lastArgs = args;
      if (!timer) timer = setTimeout(run, remaining);
    }
  }) as T;
}

// Canvas renders the infinite board surface.
export function Canvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const tool = useCanvasStore((s) => s.tool);
  const zoom = useCanvasStore((s) => s.zoom);
  const pan = useCanvasStore((s) => s.pan);
  const setZoomAt = useCanvasStore((s) => s.setZoomAt);
  const setPan = useCanvasStore((s) => s.setPan);
  const startPan = useCanvasStore((s) => s.startPan);
  const endPan = useCanvasStore((s) => s.endPan);
  const isPanning = useCanvasStore((s) => s.isPanning);
  const addStickyAt = useCanvasStore((s) => s.addStickyAt);
  const addTextAt = useCanvasStore((s) => s.addTextAt);
  const toBoardData = useCanvasStore((s) => s.toBoardData);

  const { sendCursor, sendDraw, isApplyingRemote } = useBoardSocket();

  // Mouse wheel: pan or zoom (Ctrl/Cmd to zoom).
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const point = { x: e.clientX, y: e.clientY };
      if (e.ctrlKey || e.metaKey) {
        const delta = -Math.sign(e.deltaY) * 0.1;
        setZoomAt(point, delta);
      } else {
        setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
      }
    },
    [pan.x, pan.y, setPan, setZoomAt]
  );

  // Pan with middle mouse or shift+drag.
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current) return;

      const isMiddle = e.button === 1;
      const shiftPressed = (e.nativeEvent as any).shiftKey === true;

      if (isMiddle || shiftPressed) {
        startPan({ x: e.clientX, y: e.clientY });
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }

      // Place elements depending on tool
      if (tool === "sticky" || tool === "text") {
        const rect = containerRef.current.getBoundingClientRect();
        const world = screenToWorld(
          { x: e.clientX, y: e.clientY },
          { x: rect.left, y: rect.top },
          pan,
          zoom
        );
        if (tool === "sticky") {
          addStickyAt(world.x, world.y);
        } else if (tool === "text") {
          addTextAt(world.x, world.y);
        }
      }
    },
    [tool, pan, zoom, startPan, addStickyAt, addTextAt]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return;
      endPan({ x: e.clientX, y: e.clientY }, false);
    },
    [isPanning, endPan]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return;
      endPan({ x: e.clientX, y: e.clientY }, true);
    },
    [isPanning, endPan]
  );

  const transformStyle = useMemo(
    () => ({
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: "0 0",
    }),
    [pan.x, pan.y, zoom]
  );

  // Send CURSOR events on pointer move across the viewport (throttled)
  useEffect(() => {
    const send = throttle((clientX: number, clientY: number) => {
      // Approximate container top-left (0, topbar height 48px)
      const containerTopLeft = { x: 0, y: 48 };
      const x = (clientX - containerTopLeft.x - pan.x) / zoom;
      const y = (clientY - containerTopLeft.y - pan.y) / zoom;
      void sendCursor(x, y).catch((err) => {
        console.error("Failed to send CURSOR", err);
      });
    }, 50);

    const handler = (e: PointerEvent) => {
      send(e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", handler);
    return () => {
      window.removeEventListener("pointermove", handler);
    };
  }, [pan.x, pan.y, zoom, sendCursor]);

  // Send DRAW events when local board changes (debounced)
  useEffect(() => {
    let timeout: any = null;
    const unsub = useCanvasStore.subscribe(
      (s) => [s.order, s.elements] as const,
      () => {
        if (isApplyingRemote) return; // avoid echo
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          try {
            const data = toBoardData();
            void sendDraw({ boardData: data });
          } catch (err) {
            console.error("Failed to send DRAW", err);
          }
        }, 200);
      },
      { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] }
    );
    return () => {
      if (timeout) clearTimeout(timeout);
      unsub();
    };
  }, [sendDraw, toBoardData, isApplyingRemote]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden bg-background"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="absolute inset-0">
        <Background pan={pan} zoom={zoom} />
      </div>

      <div
        ref={contentRef}
        className="absolute top-0 left-0 will-change-transform"
        style={transformStyle}
      >
        <ElementLayer />
      </div>

      <CursorLayer />
    </div>
  );
}
