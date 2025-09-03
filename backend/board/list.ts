import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { boardDB } from "./db";
import type { Board, ListBoardsResponse } from "./types";
import { getAuthData } from "~encore/auth";

interface ListBoardsParams {
  limit?: Query<number>;
}

// Retrieves boards owned by the current user, ordered by most recently created.
export const list = api<ListBoardsParams, ListBoardsResponse>(
  { expose: true, method: "GET", path: "/boards", auth: true },
  async (params) => {
    const auth = getAuthData()!;
    const limit = params.limit || 100;

    const boards = await boardDB.queryAll<Board>`
      SELECT
        id,
        COALESCE(title, name) AS title,
        created_at,
        updated_at,
        owner_id
      FROM boards
      WHERE owner_id = ${auth.userID}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return { boards };
  }
);
