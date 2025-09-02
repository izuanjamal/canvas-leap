import type { FrontendBoard } from "../services/boardLoader";
import type { BoardElement } from "../types/board";

const elements: BoardElement[] = [
  {
    id: "element-1",
    type: "sticky-note",
    x: 100,
    y: 150,
    width: 200,
    height: 100,
    color: "#FFEB3B",
    text: "Hello World!",
  },
  {
    id: "element-2",
    type: "text",
    x: 450,
    y: 200,
    width: 300,
    height: 40,
    color: "#111827",
    text: "Team Planning Board",
    fontSize: 28,
  },
];

export const sampleBoard: FrontendBoard = {
  id: "sample-board",
  name: "Team Planning Board",
  data: { elements },
};
