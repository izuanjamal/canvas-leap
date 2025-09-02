import React, { useCallback, useMemo, useRef } from "react";
import { useCanvasStore } from "../../state/canvasStore";
import { screenToWorld } from "../../utils/transform";
import { Background } from "./Background";
import { ElementLayer } from "./ElementLayer";
import { CursorLayer } from "./CursorLayer";

// Canvas renders the infinite board surface.
// For the initial version we use a DOM-based approach (absolutely positioned elements inside a transform).
// This makes interactions simple to implement and iterate on.
// If/when we need high-performance vector drawing, we can migrate the element rendering to HTML5 Canvas or Fabric.js,
// keeping the same pan/zoom math and store structure.
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

  // Pan with middle mouse or space+drag.
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current) return;

      const isMiddle = e.button === 1;
      const spacePressed = e.nativeEvent instanceof PointerEvent
        ? (e.nativeEvent as any).shiftKey // shift for pan alternative to avoid Space + browser scroll conflicts
        : false;

      if (isMiddle || spacePressed) {
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
