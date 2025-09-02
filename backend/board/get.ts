import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { BoardWithStrokes, Board, Stroke } from "./types";

interface GetBoardParams {
  id: string;
}

// Retrieves a board by its ID, including all strokes and metadata.
export const get = api<GetBoardParams, BoardWithStrokes>(
  { expose: true, method: "GET", path: "/boards/:id", auth: true },
  async (params) => {
    const board = await boardDB.queryRow<Board>`
      SELECT
        id,
        COALESCE(title, name) AS title,
        created_at,
        updated_at,
        owner_id
      FROM boards
      WHERE id = ${params.id}
    `;

    if (!board) {
      throw APIError.notFound("Board not found");
    }

    const strokes = await boardDB.queryAll<Stroke>`
      SELECT
        id,
        board_id,
        user_id,
        path_data,
        color,
        thickness,
        created_at
      FROM strokes
      WHERE board_id = ${params.id}
      ORDER BY created_at ASC
    `;

    return { board, strokes };
  }
);
