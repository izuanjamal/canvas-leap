import { create } from "zustand";
import { nanoid } from "nanoid";
import type { BoardData, BoardElement, StickyNoteElement, TextElement, Cursor } from "../types/board";
import { screenToWorld } from "../utils/transform";

type Tool = "select" | "draw" | "erase" | "text" | "sticky";
type Role = "owner" | "editor" | "viewer";

interface CanvasState {
  // Board
  boardId: string | null;
  boardName: string;
  elements: Record<string, BoardElement>;
  order: string[];

  // View state
  zoom: number;
  pan: { x: number; y: number };

  // Interaction
  tool: Tool;
  selectedId: string | null;
  isPanning: boolean;
  panStart?: { x: number; y: number };

  // Presence
  cursors: Cursor[];

  // Sharing / Permissions
  currentRole: Role | null;
  shareToken: string | null;

  // Actions
  setBoardMeta: (id: string, name: string) => void;
  setBoardFromData: (id: string, name: string, data: BoardData) => void;
  applyRemoteBoardData: (data: BoardData) => void;
  toBoardData: () => BoardData;

  setTool: (t: Tool) => void;
  select: (id: string | null) => void;

  setZoomAt: (screenPoint: { x: number; y: number }, delta: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  resetView: () => void;
  startPan: (screenPoint: { x: number; y: number }) => void;
  endPan: (screenPoint: { x: number; y: number }, finish: boolean) => void;

  addStickyAt: (x: number, y: number) => void;
  addTextAt: (x: number, y: number) => void;
  updateElement: (id: string, patch: Partial<BoardElement>) => void;
  moveBy: (id: string, dx: number, dy: number) => void;

  setCursors: (c: Cursor[]) => void;

  setCurrentRole: (r: Role | null) => void;
  setShareToken: (t: string | null) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  boardId: null,
  boardName: "",
  elements: {},
  order: [],

  zoom: 1,
  pan: { x: 0, y: 0 },

  tool: "select",
  selectedId: null,
  isPanning: false,

  cursors: [],

  currentRole: null,
  shareToken: null,

  setBoardMeta: (id, name) => set({ boardId: id, boardName: name }),

  setBoardFromData: (id, name, data) => {
    const elements: Record<string, BoardElement> = {};
    const order: string[] = [];
    for (const el of data.elements) {
      elements[el.id] = el;
      order.push(el.id);
    }
    set({ boardId: id, boardName: name, elements, order });
  },

  applyRemoteBoardData: (data) => {
    const elements: Record<string, BoardElement> = {};
    const order: string[] = [];
    for (const el of data.elements) {
      elements[el.id] = el;
      order.push(el.id);
    }
    set({ elements, order });
  },

  toBoardData: () => {
    const { order, elements } = get();
    return { elements: order.map((id) => elements[id]).filter(Boolean) as BoardElement[] };
  },

  setTool: (t) => set({ tool: t }),
  select: (id) => set({ selectedId: id }),

  setZoomAt: (screenPoint, delta) => {
    const { zoom, pan } = get();
    const newZoom = clamp(zoom + delta, 0.25, 4);
    if (newZoom === zoom) return;

    const rect = { left: 0, top: 48 };
    const worldBefore = screenToWorld(screenPoint, { x: rect.left, y: rect.top }, pan, zoom);
    const worldAfter = screenToWorld(screenPoint, { x: rect.left, y: rect.top }, pan, newZoom);

    const panDx = (worldAfter.x - worldBefore.x) * newZoom;
    const panDy = (worldAfter.y - worldBefore.y) * newZoom;

    set({ zoom: newZoom, pan: { x: pan.x + panDx, y: pan.y + panDy } });
  },

  setPan: (p) => set({ pan: p }),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),

  startPan: (screenPoint) => set({ isPanning: true, panStart: screenPoint }),
  endPan: (screenPoint, finish) => {
    const { pan, panStart } = get();
    if (!panStart) return;
    const dx = screenPoint.x - panStart.x;
    const dy = screenPoint.y - panStart.y;
    const newPan = { x: pan.x + dx, y: pan.y + dy };
    set({ pan: newPan, panStart: finish ? undefined : screenPoint, isPanning: !finish });
  },

  addStickyAt: (x, y) => {
    const id = nanoid();
    const el: StickyNoteElement = {
      id,
      type: "sticky-note",
      x,
      y,
      width: 200,
      height: 120,
      color: "#FFEB3B",
      text: "Sticky",
    };
    set((s) => ({
      elements: { ...s.elements, [id]: el },
      order: [...s.order, id],
      tool: "select",
      selectedId: id,
    }));
  },

  addTextAt: (x, y) => {
    const id = nanoid();
    const el: TextElement = {
      id,
      type: "text",
      x,
      y,
      width: 300,
      height: 40,
      text: "New text",
      color: "#111827",
      fontSize: 24,
    };
    set((s) => ({
      elements: { ...s.elements, [id]: el },
      order: [...s.order, id],
      tool: "select",
      selectedId: id,
    }));
  },

  updateElement: (id, patch) => {
    set((s) => {
      const prev = s.elements[id];
      if (!prev) return {};
      return { elements: { ...s.elements, [id]: { ...prev, ...patch } as BoardElement } };
    });
  },

  moveBy: (id, dx, dy) => {
    set((s) => {
      const el = s.elements[id];
      if (!el) return {};
      return {
        elements: {
          ...s.elements,
          [id]: { ...el, x: el.x + dx, y: el.y + dy },
        },
      };
    });
  },

  setCursors: (c) => set({ cursors: c }),

  setCurrentRole: (r) => set({ currentRole: r }),
  setShareToken: (t) => set({ shareToken: t }),
}));

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
