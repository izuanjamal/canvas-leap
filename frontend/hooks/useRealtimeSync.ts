import { useEffect, useRef } from "react";
import type { ClientMessage, ServerMessage } from "~backend/ws/types";
import { useCanvasStore } from "../state/canvasStore";
import type { BoardData, Cursor } from "../types/board";
import { getBackendClient } from "../lib/backendClient";
import { colorFromId } from "../utils/avatar";

// Simple throttle util
function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: any = null;
  let lastArgs: any[] | null = null;
  const run = () => {
    last = Date.now();
    timer = null;
    if (lastArgs) {
      fn(...(lastArgs as any));
      lastArgs = null;
    }
  };
  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      lastArgs = args;
      if (!timer) timer = setTimeout(run, remaining);
    }
  }) as T;
}

export function useRealtimeSync() {
  const get = useCanvasStore.getState;
  const setCursors = useCanvasStore((s) => s.setCursors);
  const applyRemoteBoardData = useCanvasStore((s) => s.applyRemoteBoardData);
  const toBoardData = useCanvasStore((s) => s.toBoardData);

  const streamRef = useRef<AsyncIterable<ServerMessage> & {
    send: (msg: ClientMessage) => Promise<void>;
    close?: () => Promise<void>;
  } | null>(null);

  const cursorsRef = useRef<Map<string, Cursor>>(new Map());
  const suppressSyncRef = useRef(false);
  const heartbeatRef = useRef<any>(null);
  const unsubElementsRef = useRef<(() => void) | null>(null);
  const pointerHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);

  useEffect(() => {
    let mounted = true;

    async function connect() {
      const backend = getBackendClient();

      // Wait until a board is loaded
      let boardId = get().boardId;
      if (!boardId) {
        for (let i = 0; i < 50 && !boardId; i++) {
          await new Promise((r) => setTimeout(r, 50));
          boardId = get().boardId;
        }
      }
      if (!mounted || !boardId) return;

      // Establish stream (auth is handled by backend client)
      const stream = await backend.ws.boardSync({
        boardId,
      });

      if (!mounted) {
        try { (stream as any).close?.(); } catch {}
        return;
      }

      streamRef.current = stream;

      // Initialize presence from backend
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
            if (!mounted) break;
            handleServerMessage(msg);
          }
        } catch (err) {
          console.error("Realtime stream reader error", err);
        }
      })();

      // Heartbeat every 10s
      heartbeatRef.current = setInterval(async () => {
        try {
          await stream.send({
            type: "PING",
            boardId: boardId!,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.error("Heartbeat failed", err);
        }
      }, 10_000);

      // Send cursor updates on pointer move (throttled)
      const sendCursor = throttle((x: number, y: number) => {
        if (!streamRef.current) return;
        streamRef.current.send({
          type: "CURSOR_UPDATE",
          boardId: boardId!,
          data: { x, y },
          timestamp: Date.now(),
        });
      }, 50);

      const onPointerMove = (e: PointerEvent) => {
        const pan = get().pan;
        const zoom = get().zoom;
        const screen = { x: e.clientX, y: e.clientY };
        // Approximate container top-left (0, topbar height)
        const containerTopLeft = { x: 0, y: 48 };
        const x = (screen.x - containerTopLeft.x - pan.x) / zoom;
        const y = (screen.y - containerTopLeft.y - pan.y) / zoom;
        sendCursor(x, y);
      };
      pointerHandlerRef.current = onPointerMove;
      window.addEventListener("pointermove", onPointerMove);

      // Subscribe to board changes and broadcast (debounced)
      const unsub = useCanvasStore.subscribe(
        (s) => [s.order, s.elements] as const,
        async () => {
          if (suppressSyncRef.current) return;
          await new Promise((r) => setTimeout(r, 200));
          if (!streamRef.current) return;
          try {
            const data: BoardData = toBoardData();
            await streamRef.current.send({
              type: "BOARD_UPDATE",
              boardId: boardId!,
              data,
              timestamp: Date.now(),
            });
          } catch (err) {
            console.error("Failed to send BOARD_UPDATE", err);
          }
        },
        { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] }
      );
      unsubElementsRef.current = unsub;
    }

    function handleServerMessage(msg: ServerMessage) {
      switch (msg.type) {
        case "USER_JOINED": {
          if (!msg.userId) return;
          const map = cursorsRef.current;
          const prev = map.get(msg.userId);
          const name = msg.data?.display_name ?? prev?.name ?? "User";
          const avatarUrl = msg.data?.avatar_url ?? prev?.avatarUrl ?? "";
          const color = prev?.color ?? colorFromId(msg.userId);
          map.set(msg.userId, { id: msg.userId, x: prev?.x ?? 0, y: prev?.y ?? 0, color, name, avatarUrl });
          setCursors(Array.from(map.values()));
          break;
        }
        case "USER_LEFT": {
          if (!msg.userId) return;
          const map = cursorsRef.current;
          map.delete(msg.userId);
          setCursors(Array.from(map.values()));
          break;
        }
        case "CURSOR_UPDATE": {
          if (!msg.userId) return;
          const map = cursorsRef.current;
          const prev = map.get(msg.userId);
          const name = msg.data?.display_name ?? prev?.name ?? "User";
          const avatarUrl = msg.data?.avatar_url ?? prev?.avatarUrl ?? "";
          const x = Number(msg.data?.x) || 0;
          const y = Number(msg.data?.y) || 0;
          const color = prev?.color ?? colorFromId(msg.userId);
          map.set(msg.userId, { id: msg.userId, x, y, color, name, avatarUrl });
          setCursors(Array.from(map.values()));
          break;
        }
        case "BOARD_UPDATE": {
          const data = msg.data as BoardData | undefined;
          if (!data) return;
          suppressSyncRef.current = true;
          try {
            applyRemoteBoardData(data);
          } finally {
            setTimeout(() => {
              suppressSyncRef.current = false;
            }, 0);
          }
          break;
        }
        case "PONG":
        default:
          break;
      }
    }

    connect();

    return () => {
      mounted = false;
      try {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      } catch {}
      try {
        const stream = streamRef.current;
        if (stream) {
          (stream as any).close?.();
        }
      } catch (err) {
        console.error("Error closing stream", err);
      }
      if (unsubElementsRef.current) {
        try { unsubElementsRef.current(); } catch {}
      }
      if (pointerHandlerRef.current) {
        try { window.removeEventListener("pointermove", pointerHandlerRef.current); } catch {}
      }
    };
  }, [setCursors, applyRemoteBoardData, toBoardData]);
}
