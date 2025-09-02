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
            {c.avatarUrl ? (
              <img
                src={c.avatarUrl}
                alt={c.name}
                className="w-8 h-8 rounded-full ring-2 ring-background shadow-md"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full ring-2 ring-background shadow-md"
                style={{ backgroundColor: c.color }}
              />
            )}
            <div className="text-[10px] px-1 py-0.5 rounded bg-card/90 border mt-1 shadow whitespace-nowrap">
              {c.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
