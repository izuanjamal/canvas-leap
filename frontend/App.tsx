import React, { useEffect, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toolbar } from "./components/Toolbar";
import { Canvas } from "./components/Canvas/Canvas";
import { Topbar } from "./components/Topbar";
import { useCanvasStore } from "./state/canvasStore";
import { loadInitialBoard } from "./services/boardLoader";
import { initialBoardId } from "./config";

// App is the root component for CanvasLeap's frontend.
export default function App() {
  const setBoard = useCanvasStore((s) => s.setBoardFromData);
  const setCursors = useCanvasStore((s) => s.setCursors);
  const boardName = useCanvasStore((s) => s.boardName);

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

  // Placeholder live cursors (static demo data for now).
  useEffect(() => {
    const cursors = [
      { id: "u-1", x: 300, y: 200, color: "#3B82F6", name: "Alex" },
      { id: "u-2", x: 800, y: 600, color: "#10B981", name: "Sam" },
    ];
    setCursors(cursors);
  }, [setCursors]);

  const appTitle = useMemo(() => boardName || "CanvasLeap", [boardName]);

  return (
    <div className="h-dvh w-dvw flex flex-col bg-background text-foreground overflow-hidden">
      <Topbar title={appTitle} />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <div className="flex-1">
          <Canvas />
        </div>
      </div>
      <Toaster />
    </div>
  );
}
