import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { CreateBoardRequest, Board } from "./types";
import { getAuthData } from "~encore/auth";

// Creates a new whiteboard with a title.
// If the title is empty, an automatic title is generated.
export const create = api<CreateBoardRequest, Board>(
  { expose: true, method: "POST", path: "/boards", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    const rawTitle = (req.title ?? "").trim();
    const title = rawTitle.length > 0 ? rawTitle : "Untitled Board";

    const board = await boardDB.queryRow<Board>`
      INSERT INTO boards (title, owner_id, data)
      VALUES (${title}, ${auth.userID}, ${JSON.stringify({})})
      RETURNING
        id,
        COALESCE(title, name) AS title,
        created_at,
        updated_at,
        owner_id
    `;

    if (!board) {
      throw APIError.internal("Failed to create board");
    }

    return board;
  }
);
