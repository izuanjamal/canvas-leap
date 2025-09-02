import { api } from "encore.dev/api";
import { boardDB } from "./db";
import type { CreateBoardRequest, Board } from "./types";

// Creates a new whiteboard with the given name and optional initial data.
export const create = api<CreateBoardRequest, Board>(
  { expose: true, method: "POST", path: "/boards", auth: true },
  async (req) => {
    const board = await boardDB.queryRow<Board>`
      INSERT INTO boards (name, data)
      VALUES (${req.name}, ${JSON.stringify(req.data || {})})
      RETURNING id, name, created_at, updated_at, data
    `;

    if (!board) {
      throw new Error("Failed to create board");
    }

    return board;
  }
);
