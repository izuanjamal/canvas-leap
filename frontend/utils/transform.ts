export function screenToWorld(
  screen: { x: number; y: number },
  containerTopLeft: { x: number; y: number },
  pan: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  const sx = screen.x - containerTopLeft.x;
  const sy = screen.y - containerTopLeft.y;
  return {
    x: (sx - pan.x) / zoom,
    y: (sy - pan.y) / zoom,
  };
}

export function worldToScreen(
  world: { x: number; y: number },
  pan: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  return {
    x: world.x * zoom + pan.x,
    y: world.y * zoom + pan.y,
  };
}
