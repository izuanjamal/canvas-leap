import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import backend from "~backend/client";
import type { ListBoardsResponse, Board } from "~backend/board/types";
import { getBackendClient } from "../lib/backendClient";

export function BoardsPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const sorted = useMemo(() => {
    return [...boards].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [boards]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const be = getBackendClient();
        const resp: ListBoardsResponse = await be.board.list({});
        if (!mounted) return;
        setBoards(resp.boards);
      } catch (err) {
        console.error("Failed to fetch boards", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function createBoard() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const be = getBackendClient();
      const board = await be.board.create({ title: title.trim() });
      setBoards((prev) => [board, ...prev]);
      setTitle("");
      navigate(`/boards/${board.id}`);
    } catch (err) {
      console.error("Failed to create board", err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="h-12 flex items-center justify-between px-4 border-b bg-card/60 backdrop-blur">
        <div className="font-medium text-sm">Boards</div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="New board title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-56"
          />
          <Button onClick={createBoard} disabled={creating || !title.trim()}>{creating ? "Creating..." : "Create Board"}</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading boards…</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground">No boards yet. Create your first one!</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((b) => (
              <button
                key={b.id}
                className="text-left rounded-lg border bg-card p-4 hover:shadow transition"
                onClick={() => navigate(`/boards/${b.id}`)}
              >
                <div className="font-medium">{b.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Created {new Date(b.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
