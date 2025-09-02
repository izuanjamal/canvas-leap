export type ElementType = "sticky-note" | "text";

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StickyNoteElement extends BaseElement {
  type: "sticky-note";
  color: string;
  text: string;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  color: string;
  fontSize: number;
}

export type BoardElement = StickyNoteElement | TextElement;

export interface BoardData {
  elements: BoardElement[];
}

export interface Cursor {
  id: string;
  x: number;
  y: number;
  color: string;
  name: string;
}
