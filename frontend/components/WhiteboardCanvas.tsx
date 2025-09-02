import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBoardSocket } from "../contexts/BoardSocketProvider";
import { colorFromId } from "../utils/avatar";

export type ToolKind = "pen" | "eraser";

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
  mode: "draw" | "erase";
  points: Point[];
}

export interface WhiteboardCanvasProps {
  strokeColor: string;
  brushSize: number;
  tool: ToolKind;
}

export interface WhiteboardCanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => Promise<void>;
  download: (format: "png" | "jpg") => void;
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

type RemoteCursor = {
  x: number;
  y: number;
  name: string;
  avatarUrl?: string;
  color: string;
};

const WhiteboardCanvas = React.forwardRef<WhiteboardCanvasHandle, WhiteboardCanvasProps>(function WhiteboardCanvas(
  { strokeColor, brushSize, tool }: WhiteboardCanvasProps,
  ref
) {
  const { sendCursor, sendDraw, sendClear, addEventListener } = useBoardSocket();

  // Drawing state
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const undoStackRef = useRef<Stroke[]>([]);
  const redoStackRef = useRef<Stroke[]>([]);

  // Current drawing in-progress
  const drawingRef = useRef<{
    stroke: Stroke | null;
    isDrawing: boolean;
  }>({ stroke: null, isDrawing: false });

  // Remote cursors map
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
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
      ctx.setTransform(1, 0, 0, 1, 0, 0);
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

    // Render all strokes in order
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

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = stroke.width;

    if (stroke.mode === "erase") {
      // Erase previously drawn pixels
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
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
      color: strokeColor,
      width: brushSize,
      mode: tool === "eraser" ? "erase" : "draw",
      points: [p],
    };
    drawingRef.current = { stroke, isDrawing: true };
    requestRedraw();
  }, [strokeColor, brushSize, tool, requestRedraw]);

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

  // Imperative API
  React.useImperativeHandle(
    ref,
    () => ({
      undo() {
        setStrokes((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          redoStackRef.current.push(last);
          const ns = prev.slice(0, -1);
          undoStackRef.current = [...ns];
          requestRedraw();
          return ns;
        });
      },
      redo() {
        setStrokes((prev) => {
          const redoStack = redoStackRef.current;
          if (redoStack.length === 0) return prev;
          const item = redoStack.pop()!;
          const ns = [...prev, item];
          undoStackRef.current = [...ns];
          requestRedraw();
          return ns;
        });
      },
      async clear() {
        setStrokes([]);
        undoStackRef.current = [];
        redoStackRef.current = [];
        requestRedraw();
        try {
          await sendClear();
        } catch (err) {
          console.error("Failed to send CLEAR event", err);
        }
      },
      download(format: "png" | "jpg") {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Export: for jpg, compose on white background; for png, keep transparency
        if (format === "png") {
          const url = canvas.toDataURL("image/png");
          triggerDownload(url, `canvas-${Date.now()}.png`);
        } else {
          const w = canvas.width;
          const h = canvas.height;
          const tmp = document.createElement("canvas");
          tmp.width = w;
          tmp.height = h;
          const tctx = tmp.getContext("2d")!;
          tctx.fillStyle = "#ffffff";
          tctx.fillRect(0, 0, w, h);
          tctx.drawImage(canvas, 0, 0);
          const url = tmp.toDataURL("image/jpeg", 0.92);
          triggerDownload(url, `canvas-${Date.now()}.jpg`);
        }
      },
    }),
    [requestRedraw, sendClear]
  );

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

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
          const name = String(ev.payload?.displayName || "") || ev.userId || "User";
          const avatarUrl = String(ev.payload?.avatarUrl || "");
          setRemoteCursors((prev) => {
            const next = new Map(prev);
            const color = next.get(ev.userId)?.color ?? colorFromId(ev.userId);
            next.set(ev.userId, { x, y, name, avatarUrl, color });
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
    <div className="relative h-full w-full bg-background">
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
        {Array.from(remoteCursors.entries()).map(([userId, c]) => (
          <div
            key={userId}
            className="absolute"
            style={{ left: c.x, top: c.y }}
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
            <div className="mt-1 text-[10px] px-1 py-0.5 rounded bg-card/90 border shadow whitespace-nowrap">
              {c.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default WhiteboardCanvas;
