import React, { useMemo } from "react";
import { useCanvasStore } from "../../state/canvasStore";

interface BackgroundProps {
  pan: { x: number; y: number };
  zoom: number;
}

export function Background({ pan, zoom }: BackgroundProps) {
  const gridSize = 32 * zoom;
  const dark = useCanvasStore.getState; // no-op to keep hook imports aligned

  const backgroundImage = useMemo(() => {
    const s = gridSize;
    // Create a simple grid pattern using CSS gradients.
    return `
      linear-gradient(to right, var(--border) 1px, transparent 1px),
      linear-gradient(to bottom, var(--border) 1px, transparent 1px)
    `;
  }, [gridSize]);

  const backgroundSize = `${gridSize}px ${gridSize}px`;
  const backgroundPosition = `${pan.x % gridSize}px ${pan.y % gridSize}px`;

  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage,
        backgroundSize,
        backgroundPosition,
        backgroundColor: "var(--card)",
        opacity: 0.6,
      }}
    />
  );
}
