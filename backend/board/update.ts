import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { UpdateBoardRequest, Board } from "./types";

// Updates the board data with new content from collaborative editing.
export const update = api<UpdateBoardRequest, Board>(
  { expose: true, method: "PUT", path: "/boards/:id" },
  async (req) => {
    const board = await boardDB.queryRow<Board>`
      UPDATE boards
      SET data = ${JSON.stringify(req.data)}
      WHERE id = ${req.id}
      RETURNING id, name, created_at, updated_at, data
    `;

    if (!board) {
      throw APIError.notFound("Board not found");
    }

    return board;
  }
);
