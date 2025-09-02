import React, { useEffect, useMemo, useRef, useState } from "react";
import { Topbar } from "../components/Topbar";
import { useCanvasStore } from "../state/canvasStore";
import { loadInitialBoard } from "../services/boardLoader";
import { initialBoardId } from "../config";
import WhiteboardCanvas, { type WhiteboardCanvasHandle } from "../components/WhiteboardCanvas";
import DrawingToolbar, { type ToolKind } from "../components/DrawingToolbar";

export function BoardPage() {
  const setBoard = useCanvasStore((s) => s.setBoardFromData);
  const boardName = useCanvasStore((s) => s.boardName);

  // Drawing controls state (lifted to parent)
  const [color, setColor] = useState("#0ea5e9");
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState<ToolKind>("pen");

  const canvasRef = useRef<WhiteboardCanvasHandle | null>(null);

  // Load board on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const board = await loadInitialBoard(initialBoardId);
      if (!mounted) return;
      setBoard(board.id, board.name, board.data);
      document.title = `${board.name} • CanvasLeap`;
    })();
    return () => {
      mounted = false;
    };
  }, [setBoard]);

  const appTitle = useMemo(() => boardName || "CanvasLeap", [boardName]);

  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const handleClear = () => canvasRef.current?.clear();
  const handleDownload = (format: "png" | "jpg") => canvasRef.current?.download(format);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Topbar title={appTitle} />
      <div className="flex-1 relative overflow-hidden">
        <WhiteboardCanvas
          ref={canvasRef}
          strokeColor={tool === "eraser" ? color /* unused in erase mode */ : color}
          brushSize={size}
          tool={tool}
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
          />
        </div>
      </div>
    </div>
  );
}
