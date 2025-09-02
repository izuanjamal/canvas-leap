import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasStore } from "../state/canvasStore";
import { getBackendClient } from "../lib/backendClient";
import type { UnifiedServerMessage, UnifiedClientMessage } from "~backend/ws/board_sync";
import { colorFromId } from "../utils/avatar";
import type { BoardData, Cursor } from "../types/board";
import { useToast } from "@/components/ui/use-toast";

// BoardEvent interface required by spec
export interface BoardEvent {
  type: "DRAW" | "CURSOR" | "PRESENCE" | "PING";
  userId: string;
  payload?: any;
}

interface BoardSocketContextValue {
  connected: boolean;
  isApplyingRemote: boolean;
  sendEvent: (event: BoardEvent) => Promise<void>;
  sendCursor: (x: number, y: number) => Promise<void>;
  sendDraw: (payload: any) => Promise<void>;
  sendPresence: (action: "join" | "leave") => Promise<void>;
}

const BoardSocketContext = createContext<BoardSocketContextValue | null>(null);

export function BoardSocketProvider({ children }: { children: React.ReactNode }) {
  const boardId = useCanvasStore((s) => s.boardId);
  const setCursors = useCanvasStore((s) => s.setCursors);
  const applyRemoteBoardData = useCanvasStore((s) => s.applyRemoteBoardData);

  const { toast } = useToast();

  const streamRef = useRef<(AsyncIterable<UnifiedServerMessage> & { send: (msg: UnifiedClientMessage) => Promise<void>; close?: () => Promise<void>; }) | null>(null);
  const [connected, setConnected] = useState(false);
  const [isApplyingRemote, setIsApplyingRemote] = useState(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<any>(null);
  const heartbeatRef = useRef<any>(null);

  // Keep local map of cursors for efficient updates
  const cursorsRef = useRef<Map<string, Cursor>>(new Map());

  const cleanup = useCallback(async () => {
    try {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    } catch {}
    try {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    } catch {}
    try {
      await streamRef.current?.close?.();
    } catch {}
    streamRef.current = null;
    setConnected(false);
  }, []);

  const scheduleReconnect = useCallback(() => {
    reconnectAttemptRef.current += 1;
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(30000, 1000 * Math.pow(2, attempt - 1)); // 1s, 2s, 4s, ... up to 30s
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      void connect();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    if (!boardId) return;
    // Avoid double-connect
    if (streamRef.current) return;

    try {
      const backend = getBackendClient();
      const stream = await backend.ws.boardSync({ boardId });
      streamRef.current = stream;
      setConnected(true);
      reconnectAttemptRef.current = 0;

      // Heartbeat: send ping every 10s
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(async () => {
        try {
          await stream.send({
            eventType: "PING",
            payload: { ts: Date.now() },
          } as UnifiedClientMessage);
        } catch (err) {
          // Likely disconnected; will trigger reconnect on reader loop
          console.error("Heartbeat send error", err);
        }
      }, 10_000);

      // Initial presence load via ActiveUsers API
      try {
        const resp = await backend.ws.getActiveUsers({ boardId });
        const map = new Map<string, Cursor>();
        for (const u of resp.users) {
          const color = colorFromId(u.id);
          map.set(u.id, {
            id: u.id,
            x: 0,
            y: 0,
            color,
            name: u.display_name || "User",
            avatarUrl: u.avatar_url || "",
          });
        }
        cursorsRef.current = map;
        setCursors(Array.from(map.values()));
      } catch (err) {
        console.error("Failed to load active users", err);
      }

      // Reader loop
      (async () => {
        try {
          for await (const msg of stream) {
            handleIncomingMessage(msg);
          }
        } catch (err) {
          console.error("Socket reader error", err);
        } finally {
          // Connection ended
          setConnected(false);
          streamRef.current = null;
          scheduleReconnect();
        }
      })();
    } catch (err) {
      console.error("Failed to connect WebSocket stream", err);
      setConnected(false);
      streamRef.current = null;
      scheduleReconnect();
    }
  }, [boardId, scheduleReconnect, setCursors]);

  useEffect(() => {
    if (!boardId) return;
    void connect();
    return () => {
      void cleanup();
    };
  }, [boardId, connect, cleanup]);

  const toBoardEvent = (msg: UnifiedServerMessage): BoardEvent | null => {
    if ((msg as any).eventType) {
      // New enhanced event
      const type = (msg as any).eventType as BoardEvent["type"];
      return { type, userId: (msg as any).userId ?? "", payload: (msg as any).payload };
    }
    // Legacy mapping
    switch (msg.type) {
      case "CURSOR_UPDATE":
        return { type: "CURSOR", userId: msg.userId ?? "", payload: msg.data };
      case "BOARD_UPDATE":
        return { type: "DRAW", userId: msg.userId ?? "", payload: { boardData: msg.data } };
      case "USER_JOINED":
        return { type: "PRESENCE", userId: msg.userId ?? "", payload: { action: "join", data: msg.data } };
      case "USER_LEFT":
        return { type: "PRESENCE", userId: msg.userId ?? "", payload: { action: "leave" } };
      case "PONG":
        return { type: "PING", userId: "server", payload: { action: "pong", timestamp: msg.timestamp } };
      default:
        return null;
    }
  };

  const handleIncomingMessage = (msg: UnifiedServerMessage) => {
    const ev = toBoardEvent(msg);
    if (!ev) return;

    switch (ev.type) {
      case "CURSOR": {
        const { x, y, displayName, avatarUrl } = ev.payload ?? {};
        const map = cursorsRef.current;
        const prev = map.get(ev.userId);
        const name = displayName ?? prev?.name ?? "User";
        const avatar = avatarUrl ?? prev?.avatarUrl ?? "";
        const color = prev?.color ?? colorFromId(ev.userId);
        const nx = Number(x) || prev?.x || 0;
        const ny = Number(y) || prev?.y || 0;
        map.set(ev.userId, { id: ev.userId, x: nx, y: ny, color, name, avatarUrl: avatar });
        setCursors(Array.from(map.values()));
        break;
      }
      case "PRESENCE": {
        const action = ev.payload?.action as "join" | "leave" | undefined;
        if (action === "join") {
          toast({
            title: "User joined",
            description: ev.payload?.displayName || ev.userId,
          });
        } else if (action === "leave") {
          toast({
            title: "User left",
            description: ev.userId,
          });
        }
        // Optionally update cursors list sent in payload.connectedUsers
        if (Array.isArray(ev.payload?.connectedUsers)) {
          const map = new Map<string, Cursor>();
          for (const u of ev.payload.connectedUsers) {
            const color = colorFromId(u.userId);
            map.set(u.userId, {
              id: u.userId,
              x: cursorsRef.current.get(u.userId)?.x ?? 0,
              y: cursorsRef.current.get(u.userId)?.y ?? 0,
              color,
              name: u.displayName || "User",
              avatarUrl: u.avatarUrl || "",
            });
          }
          cursorsRef.current = map;
          setCursors(Array.from(map.values()));
        }
        break;
      }
      case "DRAW": {
        // If the payload contains boardData, apply it
        const boardData: BoardData | undefined = ev.payload?.boardData;
        if (boardData) {
          setIsApplyingRemote(true);
          try {
            applyRemoteBoardData(boardData);
          } finally {
            // Allow senders to skip echo for this tick
            setTimeout(() => setIsApplyingRemote(false), 0);
          }
        }
        break;
      }
      case "PING":
      default:
        break;
    }
  };

  const sendEvent = useCallback(async (event: BoardEvent) => {
    const stream = streamRef.current;
    if (!stream) throw new Error("WebSocket not connected");
    // Send in new enhanced format while keeping compatibility
    const msg: UnifiedClientMessage = {
      // @ts-expect-error eventType is used by backend
      eventType: event.type,
      // optional legacy mapping if needed:
      // type: event.type === "CURSOR" ? "CURSOR_UPDATE" : undefined,
      payload: event.payload,
      userId: event.userId,
    } as any;
    await stream.send(msg);
  }, []);

  const sendCursor = useCallback(async (x: number, y: number) => {
    await sendEvent({
      type: "CURSOR",
      userId: "",
      payload: { x, y },
    });
  }, [sendEvent]);

  const sendDraw = useCallback(async (payload: any) => {
    await sendEvent({
      type: "DRAW",
      userId: "",
      payload,
    });
  }, [sendEvent]);

  const sendPresence = useCallback(async (action: "join" | "leave") => {
    await sendEvent({
      type: "PRESENCE",
      userId: "",
      payload: { action },
    });
  }, [sendEvent]);

  const value = useMemo<BoardSocketContextValue>(() => ({
    connected,
    isApplyingRemote,
    sendEvent,
    sendCursor,
    sendDraw,
    sendPresence,
  }), [connected, isApplyingRemote, sendEvent, sendCursor, sendDraw, sendPresence]);

  return (
    <BoardSocketContext.Provider value={value}>{children}</BoardSocketContext.Provider>
  );
}

export function useBoardSocket() {
  const ctx = useContext(BoardSocketContext);
  if (!ctx) {
    throw new Error("useBoardSocket must be used within BoardSocketProvider");
  }
  return ctx;
}
