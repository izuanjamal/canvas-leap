import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Link as LinkIcon, Lock, RefreshCw, Unlock } from "lucide-react";
import { getBackendClient } from "../lib/backendClient";
import { useCanvasStore } from "../state/canvasStore";
import type { ShareStatusResponse, ShareManageResponse } from "~backend/board/types";
import { useToast } from "@/components/ui/use-toast";

export function ShareDialog() {
  const boardId = useCanvasStore((s) => s.boardId);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatusResponse>({ enabled: false });
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const { toast } = useToast();

  const inviteLink = useMemo(() => {
    if (!status.enabled || !status.token) return "";
    const base = window.location.origin;
    return `${base}/s/${status.token}`;
  }, [status.enabled, status.token]);

  useEffect(() => {
    if (!open || !boardId) return;
    (async () => {
      try {
        const be = getBackendClient();
        const res: ShareStatusResponse = await be.board.shareStatus({ id: boardId });
        setStatus(res);
        if (res.role) setRole(res.role);
      } catch (err) {
        console.error("Failed to load share status", err);
      }
    })();
  }, [open, boardId]);

  async function setPublic() {
    if (!boardId) return;
    try {
      const be = getBackendClient();
      const res: ShareManageResponse = await be.board.manageShare({ id: boardId, action: "enable", role });
      setStatus({ enabled: res.status === "enabled", token: res.token, role: res.role });
      toast({ title: "Link enabled", description: "Anyone with the link can access this board." });
    } catch (err) {
      console.error("Enable share failed", err);
      toast({ title: "Failed to enable link", variant: "destructive" });
    }
  }

  async function setPrivate() {
    if (!boardId) return;
    try {
      const be = getBackendClient();
      const res: ShareManageResponse = await be.board.manageShare({ id: boardId, action: "disable" });
      setStatus({ enabled: res.status === "enabled", token: res.token, role: res.role });
      toast({ title: "Link disabled", description: "The previous link no longer works." });
    } catch (err) {
      console.error("Disable share failed", err);
      toast({ title: "Failed to disable link", variant: "destructive" });
    }
  }

  async function rotateLink() {
    if (!boardId) return;
    try {
      const be = getBackendClient();
      const res: ShareManageResponse = await be.board.manageShare({ id: boardId, action: "rotate", role });
      setStatus({ enabled: res.status === "enabled", token: res.token, role: res.role });
      toast({ title: "Link rotated", description: "A new link was generated." });
    } catch (err) {
      console.error("Rotate share failed", err);
      toast({ title: "Failed to rotate link", variant: "destructive" });
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({ title: "Link copied", description: "Share it with your collaborators." });
    } catch (err) {
      console.error("Copy failed", err);
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <LinkIcon className="size-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share board</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Access</Label>
            <div className="flex items-center gap-2">
              {status.enabled ? (
                <>
                  <Unlock className="size-4 text-emerald-500" />
                  <span className="text-sm">Public link enabled</span>
                </>
              ) : (
                <>
                  <Lock className="size-4 text-yellow-500" />
                  <span className="text-sm">Private (owner &amp; invited users only)</span>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Public link role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)} disabled={!status.enabled}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Invite link</Label>
            <div className="flex items-center gap-2">
              <Input value={inviteLink} readOnly placeholder="Enable sharing to generate a link" />
              <Button variant="secondary" size="icon" onClick={copyLink} disabled={!status.enabled || !status.token} aria-label="Copy">
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between">
          <div className="flex items-center gap-2">
            <Button variant={status.enabled ? "secondary" : "default"} onClick={status.enabled ? rotateLink : setPublic}>
              {status.enabled ? (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  Rotate link
                </>
              ) : (
                <>
                  <Unlock className="size-4 mr-2" />
                  Enable public link
                </>
              )}
            </Button>
          </div>
          {status.enabled && (
            <Button variant="destructive" onClick={setPrivate}>
              <Lock className="size-4 mr-2" />
              Disable link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
