import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBoardSocket } from "../contexts/BoardSocketProvider";

// 2D point
interface Point {
  x: number;
  y: number;
}

// A single freehand stroke
export interface Stroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: Point[];
}

// Throttle helper (e.g. 30fps ~ 33ms)
function throttle<T extends (...args: any[]) => void>(fn: T, intervalMs: number): T {
  let last = 0;
  let timer: any = null;
  let lastArgs: any[] | null = null;
  const invoke = () => {
    last = Date.now();
    timer = null;
    if (lastArgs) {
      fn(...(lastArgs as any));
      lastArgs = null;
    }
  };
  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = intervalMs - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      lastArgs = args;
      if (!timer) timer = setTimeout(invoke, remaining);
    }
  }) as T;
}

// Generate reasonably unique ids
function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export default function WhiteboardCanvas() {
  const { sendCursor, sendDraw, sendClear, addEventListener } = useBoardSocket();

  // Drawing state
  const [color, setColor] = useState("#0ea5e9"); // sky-500
  const [width, setWidth] = useState(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const undoStackRef = useRef<Stroke[]>([]);
  const redoStackRef = useRef<Stroke[]>([]);

  // Current drawing in-progress
  const drawingRef = useRef<{
    stroke: Stroke | null;
    isDrawing: boolean;
  }>({ stroke: null, isDrawing: false });

  // Remote cursors map
  const [remoteCursors, setRemoteCursors] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const needsRedrawRef = useRef(false);
  const dprRef = useRef<number>(1);

  // Initialize canvas and resize handling
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    const resize = () => {
      const parent = canvas.parentElement!;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      dprRef.current = dpr;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      requestRedraw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    resize();

    return () => {
      ro.disconnect();
    };
  }, []);

  // Rendering via requestAnimationFrame
  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    // Clear
    ctx.save();
    const dpr = dprRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Render all strokes
    for (const s of strokes) {
      drawStroke(ctx, s);
    }

    // Render current stroke in-progress
    const current = drawingRef.current.stroke;
    if (current && current.points.length > 1) {
      drawStroke(ctx, current);
    }

    ctx.restore();
  }, [strokes]);

  const onAnimationFrame = useCallback(() => {
    rafRef.current = null;
    if (needsRedrawRef.current) {
      needsRedrawRef.current = false;
      drawAll();
    }
  }, [drawAll]);

  const requestRedraw = useCallback(() => {
    needsRedrawRef.current = true;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(onAnimationFrame);
    }
  }, [onAnimationFrame]);

  // Draw a single stroke
  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    const pts = stroke.points;
    if (pts.length < 2) return;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // Pointer helpers
  const getLocalPoint = (e: PointerEvent | React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (e as PointerEvent).clientX - rect.left;
    const y = (e as PointerEvent).clientY - rect.top;
    return { x, y };
  };

  // Throttled cursor sender (30fps)
  const sendCursorThrottled = useMemo(
    () => throttle((x: number, y: number) => void sendCursor(x, y).catch(() => {}), 33),
    [sendCursor]
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getLocalPoint(e);
    const stroke: Stroke = {
      id: uid(),
      userId: "",
      color,
      width,
      points: [p],
    };
    drawingRef.current = { stroke, isDrawing: true };
    requestRedraw();
  }, [color, width, requestRedraw]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const dr = drawingRef.current;
    const p = getLocalPoint(e);
    sendCursorThrottled(p.x, p.y);

    if (!dr.isDrawing || !dr.stroke) return;
    const last = dr.stroke.points[dr.stroke.points.length - 1];
    // Add point only if moved enough to reduce noise
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy > 1.5) {
      dr.stroke.points.push(p);
      requestRedraw();
    }
  }, [requestRedraw, sendCursorThrottled]);

  const endStroke = useCallback(async () => {
    const dr = drawingRef.current;
    if (!dr.isDrawing || !dr.stroke) return;
    const stroke = dr.stroke;
    dr.isDrawing = false;
    dr.stroke = null;

    if (stroke.points.length > 1) {
      // Commit to local state
      setStrokes((prev) => {
        const ns = [...prev, stroke];
        undoStackRef.current = [...ns]; // maintain a simple snapshot stack for undo baseline
        return ns;
      });
      // Clear redo stack on new action
      redoStackRef.current = [];

      // Send after each stroke
      try {
        await sendDraw({ stroke });
      } catch (err) {
        console.error("Failed to send DRAW stroke", err);
      }
    }
    requestRedraw();
  }, [requestRedraw, sendDraw]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    endStroke().catch(() => {});
  }, [endStroke]);

  const onPointerCancel = useCallback(() => {
    endStroke().catch(() => {});
  }, [endStroke]);

  // Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const z = e.key.toLowerCase() === "z";
      if ((e.ctrlKey || e.metaKey) && z) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Undo/Redo (local only)
  const undo = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      redoStackRef.current.push(last);
      const ns = prev.slice(0, -1);
      undoStackRef.current = [...ns];
      requestRedraw();
      return ns;
    });
  }, [requestRedraw]);

  const redo = useCallback(() => {
    setStrokes((prev) => {
      const redoStack = redoStackRef.current;
      if (redoStack.length === 0) return prev;
      const item = redoStack.pop()!;
      const ns = [...prev, item];
      undoStackRef.current = [...ns];
      requestRedraw();
      return ns;
    });
  }, [requestRedraw]);

  const clearBoard = useCallback(async () => {
    setStrokes([]);
    undoStackRef.current = [];
    redoStackRef.current = [];
    requestRedraw();
    try {
      await sendClear();
    } catch (err) {
      console.error("Failed to send CLEAR event", err);
    }
  }, [requestRedraw, sendClear]);

  // Subscribe to incoming board events
  useEffect(() => {
    const unsubscribe = addEventListener((ev) => {
      switch (ev.type) {
        case "DRAW": {
          // Expect payload.stroke from other users
          const stroke: Stroke | undefined = ev.payload?.stroke;
          if (stroke && stroke.points?.length > 1) {
            setStrokes((prev) => {
              const ns = [...prev, { ...stroke }];
              requestRedraw();
              return ns;
            });
          }
          break;
        }
        case "CLEAR": {
          setStrokes([]);
          undoStackRef.current = [];
          redoStackRef.current = [];
          requestRedraw();
          break;
        }
        case "CURSOR": {
          const x = Number(ev.payload?.x) || 0;
          const y = Number(ev.payload?.y) || 0;
          setRemoteCursors((prev) => {
            const next = new Map(prev);
            next.set(ev.userId, { x, y });
            return next;
          });
          break;
        }
        default:
          break;
      }
    });
    return () => {
      unsubscribe();
    };
  }, [addEventListener, requestRedraw]);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-background">
      {/* Controls */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2 rounded border bg-card/70 backdrop-blur px-2 py-1">
        <label className="text-xs flex items-center gap-1">
          <span>Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-8 bg-transparent cursor-pointer"
            aria-label="Stroke color"
          />
        </label>
        <label className="text-xs flex items-center gap-1">
          <span>Width</span>
          <input
            type="range"
            min={1}
            max={24}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="w-24"
            aria-label="Stroke width"
          />
          <span className="tabular-nums w-6 text-right">{width}</span>
        </label>
        <button
          className="text-xs rounded border px-2 py-1 hover:bg-accent"
          onClick={undo}
          aria-label="Undo"
        >
          Undo
        </button>
        <button
          className="text-xs rounded border px-2 py-1 hover:bg-accent"
          onClick={redo}
          aria-label="Redo"
        >
          Redo
        </button>
        <button
          className="text-xs rounded border px-2 py-1 hover:bg-destructive/10 text-destructive"
          onClick={clearBoard}
          aria-label="Clear board"
        >
          Clear
        </button>
      </div>

      {/* Drawing canvas */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="block w-full h-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      </div>

      {/* Remote cursors overlay */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from(remoteCursors.entries()).map(([userId, p]) => (
          <div
            key={userId}
            className="absolute"
            style={{ left: p.x, top: p.y }}
          >
            <div className="w-3 h-3 rounded-full bg-primary border-2 border-background shadow" />
            <div className="mt-1 text-[10px] px-1 py-0.5 rounded bg-card/80 border shadow whitespace-nowrap">
              {userId}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
