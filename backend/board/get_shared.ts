import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { GetSharedParams, SharedBoardResponse, Board, Stroke } from "./types";
import { resolveShareToken, touchShareToken } from "./permissions";

// Fetches board data using a share token, without requiring authentication.
export const getShared = api<GetSharedParams, SharedBoardResponse>(
  { expose: true, method: "GET", path: "/shared/:token" },
  async (params) => {
    const tok = await resolveShareToken(params.token);
    if (!tok || !tok.enabled) {
      throw APIError.permissionDenied("invalid or disabled share link");
    }

    const board = await boardDB.queryRow<Board>`
      SELECT
        id,
        COALESCE(title, name) AS title,
        created_at,
        updated_at,
        owner_id
      FROM boards
      WHERE id = ${tok.board_id}
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
      WHERE board_id = ${tok.board_id}
      ORDER BY created_at ASC
    `;

    await touchShareToken(tok.id);

    return { board, strokes, role: tok.role };
  }
);
