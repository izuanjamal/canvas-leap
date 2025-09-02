import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { UpdateBoardRequest, Board } from "./types";
import { getAuthData } from "~encore/auth";
import { requireMinRole } from "./permissions";

// Updates the board data with new content from collaborative editing.
// Requires editor or owner role.
export const update = api<UpdateBoardRequest, Board>(
  { expose: true, method: "PUT", path: "/boards/:id", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await requireMinRole(req.id, auth.userID, "editor");

    const board = await boardDB.queryRow<Board>`
      UPDATE boards
      SET data = ${JSON.stringify(req.data)}
      WHERE id = ${req.id}
      RETURNING
        id,
        COALESCE(title, name) AS title,
        created_at,
        updated_at,
        owner_id
    `;

    if (!board) {
      throw APIError.notFound("Board not found");
    }

    return board;
  }
);
