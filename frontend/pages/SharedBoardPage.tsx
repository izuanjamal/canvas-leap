import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Topbar } from "../components/Topbar";
import WhiteboardCanvas, { type WhiteboardCanvasHandle, type Stroke as CanvasStroke } from "../components/WhiteboardCanvas";
import DrawingToolbar, { type ToolKind } from "../components/DrawingToolbar";
import backend from "~backend/client";
import type { SharedBoardResponse, Stroke as BackendStroke } from "~backend/board/types";
import { useCanvasStore } from "../state/canvasStore";

export function SharedBoardPage() {
  const { token } = useParams<{ token: string }>();
  const setBoardMeta = useCanvasStore((s) => s.setBoardMeta);
  const setShareToken = useCanvasStore((s) => s.setShareToken);
  const setCurrentRole = useCanvasStore((s) => s.setCurrentRole);
  const boardName = useCanvasStore((s) => s.boardName);

  const [color, setColor] = useState("#0ea5e9");
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState<ToolKind>("pen");
  const [initialStrokes, setInitialStrokes] = useState<CanvasStroke[] | null>(null);

  const canvasRef = useRef<WhiteboardCanvasHandle | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) return;
      try {
        const resp: SharedBoardResponse = await backend.board.getShared({ token });
        if (!mounted) return;
        setBoardMeta(resp.board.id, resp.board.title);
        setShareToken(token);
        setCurrentRole(resp.role);
        document.title = `${resp.board.title} • CanvasLeap`;
        const strokes: CanvasStroke[] = resp.strokes.map(mapBackendStrokeToCanvas);
        setInitialStrokes(strokes);
      } catch (err) {
        console.error("Failed to load shared board", err);
      }
    })();
    return () => {
      mounted = false;
      setShareToken(null);
    };
  }, [token, setBoardMeta, setShareToken, setCurrentRole]);

  const appTitle = useMemo(() => boardName || "CanvasLeap", [boardName]);

  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const handleClear = () => canvasRef.current?.clear();
  const handleDownload = (format: "png" | "jpg") => canvasRef.current?.download(format);

  const canEdit = useCanvasStore((s) => s.currentRole !== "viewer");

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Topbar title={appTitle} />
      <div className="flex-1 relative overflow-hidden">
        <WhiteboardCanvas
          ref={canvasRef}
          strokeColor={tool === "eraser" ? color : color}
          brushSize={size}
          tool={tool}
          initialStrokes={initialStrokes ?? undefined}
        />

        {/* Floating drawing toolbar */}
        <div className="absolute bottom-4 left-4 pointer-events-none">
          <DrawingToolbar
            color={color}
            onColorChange={setColor}
            size={size}
            onSizeChange={setSize}
            tool={tool}
            onToolChange={setTool}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            onDownload={handleDownload}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  );
}

function mapBackendStrokeToCanvas(s: BackendStroke): CanvasStroke {
  const points = Array.isArray(s.path_data?.points) ? s.path_data.points : [];
  const mode = s.path_data?.mode === "erase" ? "erase" : "draw";
  return {
    id: s.id,
    userId: s.user_id,
    color: s.color || "#000000",
    width: s.thickness || 2,
    mode,
    points: points.map((p: any) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 })),
  };
}
