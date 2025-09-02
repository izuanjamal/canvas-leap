import backend from "~backend/client";
import type { Board as BackendBoard } from "~backend/board/types";
import type { BoardData, BoardElement, StickyNoteElement, TextElement } from "../types/board";
import { sampleBoard } from "../data/sampleBoard";

export interface FrontendBoard {
  id: string;
  name: string;
  data: BoardData;
}

// Loads the initial board from the backend if an ID is provided.
// Falls back to a local sample board otherwise.
export async function loadInitialBoard(initialBoardId: string): Promise<FrontendBoard> {
  if (initialBoardId) {
    try {
      const b = await backend.board.get({ id: initialBoardId });
      return convertBackendBoard(b);
    } catch (err) {
      console.error("Failed to load board from backend, using sample.", err);
    }
  }
  return sampleBoard;
}

function convertBackendBoard(b: BackendBoard): FrontendBoard {
  const elements = Array.isArray((b.data as any)?.elements)
    ? (b.data as any).elements
    : [];
  return {
    id: b.id,
    name: b.name,
    data: {
      elements: elements.map(normalizeElement).filter(Boolean) as BoardElement[],
    },
  };
}

function normalizeElement(el: any): BoardElement | null {
  if (!el || typeof el !== "object") return null;
  if (el.type === "sticky-note") {
    const out: StickyNoteElement = {
      id: String(el.id ?? cryptoRandomId()),
      type: "sticky-note",
      x: toNum(el.x, 0),
      y: toNum(el.y, 0),
      width: toNum(el.width, 200),
      height: toNum(el.height, 120),
      color: String(el.color ?? "#FFEB3B"),
      text: String(el.text ?? ""),
    };
    return out;
  }
  if (el.type === "text") {
    const out: TextElement = {
      id: String(el.id ?? cryptoRandomId()),
      type: "text",
      x: toNum(el.x, 0),
      y: toNum(el.y, 0),
      width: toNum(el.width, 300),
      height: toNum(el.height, 40),
      color: String(el.color ?? "#111827"),
      text: String(el.text ?? ""),
      fontSize: toNum(el.fontSize, 24),
    };
    return out;
  }
  return null;
}

function toNum(v: any, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
