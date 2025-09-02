import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { CreateBoardRequest, Board } from "./types";
import { getAuthData } from "~encore/auth";

// Creates a new whiteboard with a title.
export const create = api<CreateBoardRequest, Board>(
  { expose: true, method: "POST", path: "/boards", auth: true },
  async (req) => {
    if (!req.title || !req.title.trim()) {
      throw APIError.invalidArgument("title is required");
    }

    const auth = getAuthData()!;

    const board = await boardDB.queryRow<Board>`
      INSERT INTO boards (title, owner_id, data)
      VALUES (${req.title.trim()}, ${auth.userID}, ${JSON.stringify({})})
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
