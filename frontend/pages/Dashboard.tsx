import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Board, ListBoardsResponse } from "~backend/board/types";
import { getBackendClient } from "../lib/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash, Loader2 } from "lucide-react";
import { useAuthStore } from "../state/authStore";
import { useToast } from "@/components/ui/use-toast";

export function DashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  // Create board dialog state
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  // Delete dialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        toast({ title: "Failed to load boards", variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const sorted = useMemo(
    () => [...boards].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [boards]
  );

  async function handleCreate() {
    setCreating(true);
    try {
      const now = new Date();
      const temp: Board = {
        id: `temp-${crypto.randomUUID()}`,
        title: title.trim() || "Untitled Board",
        created_at: now as any,
        updated_at: now as any,
        owner_id: user?.id ?? user?.email ?? undefined,
      } as any;

      setBoards((prev) => [temp, ...prev]);

      const be = getBackendClient();
      const created = await be.board.create({ title: title.trim() || undefined });

      setBoards((prev) => {
        const idx = prev.findIndex((b) => b.id === temp.id);
        if (idx === -1) return [created, ...prev];
        const next = [...prev];
        next[idx] = created;
        return next;
      });

      setTitle("");
      setOpen(false);
      toast({ title: "Board created", description: created.title });
    } catch (err) {
      console.error("Create board failed", err);
      // Revert optimistic add
      setBoards((prev) => prev.filter((b) => !b.id.startsWith("temp-")));
      toast({ title: "Failed to create board", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const id = deleteId;
    setDeleteId(null);

    // Optimistically remove
    const prevBoards = boards;
    setBoards((cur) => cur.filter((b) => b.id !== id));

    try {
      const be = getBackendClient();
      await be.board.deleteBoard({ id });
      toast({ title: "Board deleted" });
    } catch (err) {
      console.error("Delete board failed", err);
      // Revert
      setBoards(prevBoards);
      toast({ title: "Failed to delete board", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="h-12 flex items-center justify-between px-4 border-b bg-card/60 backdrop-blur">
        <div className="font-medium text-sm">Dashboard</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              New Board
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create a new board</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2">
              <Input
                placeholder="Board title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="size-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading boards…</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground">No boards yet. Create your first one!</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((b) => (
              <Card
                key={b.id}
                className="hover:shadow-md transition cursor-pointer"
                onClick={() => navigate(`/board/${b.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">{b.title}</CardTitle>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(b.id);
                          }}
                          aria-label="Delete board"
                        >
                          <Trash className="size-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this board?</AlertDialogTitle>
                        </AlertDialogHeader>
                        <p className="text-sm text-muted-foreground">
                          This action cannot be undone. This will permanently delete the board and all of its data.
                        </p>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDelete().catch(() => {});
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleting}
                          >
                            {deleting && <Loader2 className="size-4 mr-2 animate-spin" />}
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(b.created_at as any).toLocaleString()}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Owner</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating New Board Button */}
      <div className="fixed bottom-6 right-6">
        <Button size="lg" className="rounded-full shadow-lg" onClick={() => setOpen(true)} aria-label="New Board">
          <Plus className="size-5 mr-2" />
          New Board
        </Button>
      </div>
    </div>
  );
}
