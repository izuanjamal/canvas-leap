import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { BoardWithStrokes, Board, Stroke, Role } from "./types";
import { getAuthData } from "~encore/auth";
import { getUserRole } from "./permissions";

interface GetBoardParams {
  id: string;
}

// Retrieves a board by its ID, including all strokes and metadata.
// Enforces that the authenticated user must have access to the board.
export const get = api<GetBoardParams, BoardWithStrokes>(
  { expose: true, method: "GET", path: "/boards/:id", auth: true },
  async (params) => {
    const auth = getAuthData()!;
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

    // Verify user has access
    const role = (await getUserRole(params.id, auth.userID)) as Role | null;
    if (!role) {
      throw APIError.permissionDenied("You do not have access to this board");
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

    return { board, strokes, current_role: role };
  }
);
