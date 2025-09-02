import React, { useEffect, useMemo } from "react";
import { Topbar } from "../components/Topbar";
import { useCanvasStore } from "../state/canvasStore";
import { loadInitialBoard } from "../services/boardLoader";
import { initialBoardId } from "../config";
import WhiteboardCanvas from "../components/WhiteboardCanvas";

export function BoardPage() {
  const setBoard = useCanvasStore((s) => s.setBoardFromData);
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

  const appTitle = useMemo(() => boardName || "CanvasLeap", [boardName]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Topbar title={appTitle} />
      <div className="flex-1 overflow-hidden">
        <WhiteboardCanvas />
      </div>
    </div>
  );
}
