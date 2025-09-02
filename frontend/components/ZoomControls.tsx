import React from "react";
import { Button } from "@/components/ui/button";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCanvasStore } from "../state/canvasStore";

export function ZoomControls() {
  const zoom = useCanvasStore((s) => s.zoom);
  const setZoomAt = useCanvasStore((s) => s.setZoomAt);
  const resetView = useCanvasStore((s) => s.resetView);

  const handleZoom = (delta: number) => {
    // Zoom around center of viewport
    const viewportCenter = {
      x: window.innerWidth / 2,
      y: (window.innerHeight - 48) / 2, // subtract topbar height
    };
    setZoomAt(viewportCenter, delta);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs tabular-nums w-14 text-right">{Math.round(zoom * 100)}%</div>
      <div className="flex gap-1">
        <Button size="icon" variant="secondary" onClick={() => handleZoom(-0.1)} aria-label="Zoom out">
          <Minus className="size-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={() => handleZoom(+0.1)} aria-label="Zoom in">
          <Plus className="size-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={() => resetView()} aria-label="Reset view">
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
