import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { Board } from "./types";

interface GetBoardParams {
  id: string;
}

// Retrieves a board by its ID, including all board data and metadata.
export const get = api<GetBoardParams, Board>(
  { expose: true, method: "GET", path: "/boards/:id" },
  async (params) => {
    const board = await boardDB.queryRow<Board>`
      SELECT id, name, created_at, updated_at, data
      FROM boards
      WHERE id = ${params.id}
    `;

    if (!board) {
      throw APIError.notFound("Board not found");
    }

    return board;
  }
);
