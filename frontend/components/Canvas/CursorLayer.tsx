import React from "react";
import { useCanvasStore } from "../../state/canvasStore";
import { worldToScreen } from "../../utils/transform";

export function CursorLayer() {
  const cursors = useCanvasStore((s) => s.cursors);
  const pan = useCanvasStore((s) => s.pan);
  const zoom = useCanvasStore((s) => s.zoom);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {cursors.map((c) => {
        const pt = worldToScreen({ x: c.x, y: c.y }, pan, zoom);
        return (
          <div
            key={c.id}
            className="absolute"
            style={{ left: pt.x, top: pt.y }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-background"
              style={{ backgroundColor: c.color }}
            />
            <div className="text-[10px] px-1 py-0.5 rounded bg-card/80 border mt-1 shadow whitespace-nowrap">
              {c.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
