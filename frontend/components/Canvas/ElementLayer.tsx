import React, { useCallback, useMemo, useRef, useState } from "react";
import { useCanvasStore } from "../../state/canvasStore";
import type { BoardElement, StickyNoteElement, TextElement } from "../../types/board";

export function ElementLayer() {
  const order = useCanvasStore((s) => s.order);
  const elements = useCanvasStore((s) => s.elements);

  return (
    <div className="relative">
      {order.map((id) => {
        const el = elements[id];
        if (!el) return null;
        return <ElementItem key={id} element={el} />;
      })}
    </div>
  );
}

function ElementItem({ element }: { element: BoardElement }) {
  switch (element.type) {
    case "sticky-note":
      return <StickyNoteItem element={element} />;
    case "text":
      return <TextItem element={element} />;
    default:
      return null;
  }
}

function StickyNoteItem({ element }: { element: StickyNoteElement }) {
  const zoom = useCanvasStore((s) => s.zoom);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const select = useCanvasStore((s) => s.select);
  const moveBy = useCanvasStore((s) => s.moveBy);
  const updateElement = useCanvasStore((s) => s.updateElement);

  const isSelected = selectedId === element.id;
  const draggingRef = useRef<{ id: number; startX: number; startY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    select(element.id);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    draggingRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY };
  }, [element.id, select]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = (e.clientX - draggingRef.current.startX) / zoom;
    const dy = (e.clientY - draggingRef.current.startY) / zoom;
    draggingRef.current.startX = e.clientX;
    draggingRef.current.startY = e.clientY;
    moveBy(element.id, dx, dy);
  }, [moveBy, element.id, zoom]);

  const onPointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  const onInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent ?? "";
    updateElement(element.id, { text });
  }, [element.id, updateElement]);

  const style = useMemo(
    () => ({
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      backgroundColor: element.color,
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    }),
    [element.x, element.y, element.width, element.height, element.color]
  );

  return (
    <div
      className="absolute rounded p-2 select-none"
      style={style as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="w-full h-full outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        spellCheck={false}
        style={{
          fontSize: 14,
          lineHeight: 1.2,
          fontWeight: 500,
          color: "#111827",
        }}
      >
        {element.text}
      </div>
      {isSelected && (
        <div className="absolute inset-0 rounded ring-2 ring-primary pointer-events-none" />
      )}
    </div>
  );
}

function TextItem({ element }: { element: TextElement }) {
  const zoom = useCanvasStore((s) => s.zoom);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const select = useCanvasStore((s) => s.select);
  const moveBy = useCanvasStore((s) => s.moveBy);
  const updateElement = useCanvasStore((s) => s.updateElement);

  const isSelected = selectedId === element.id;
  const draggingRef = useRef<{ id: number; startX: number; startY: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    select(element.id);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    draggingRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY };
  }, [element.id, select]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = (e.clientX - draggingRef.current.startX) / zoom;
    const dy = (e.clientY - draggingRef.current.startY) / zoom;
    draggingRef.current.startX = e.clientX;
    draggingRef.current.startY = e.clientY;
    moveBy(element.id, dx, dy);
  }, [moveBy, element.id, zoom]);

  const onPointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  const onInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent ?? "";
    updateElement(element.id, { text });
  }, [element.id, updateElement]);

  const style = useMemo(
    () => ({
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      color: element.color,
    }),
    [element.x, element.y, element.width, element.height, element.color]
  );

  return (
    <div
      className="absolute select-none"
      style={style as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        spellCheck={false}
        style={{
          fontSize: element.fontSize,
          lineHeight: 1.2,
          fontWeight: 600,
        }}
      >
        {element.text}
      </div>
      {isSelected && (
        <div className="absolute -inset-1 rounded ring-2 ring-primary/70 pointer-events-none" />
      )}
    </div>
  );
}
