import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { boardDB } from "./db";
import type { Board } from "./types";

interface ListBoardsParams {
  limit?: Query<number>;
}

interface ListBoardsResponse {
  boards: Board[];
}

// Retrieves all boards ordered by most recently updated.
export const list = api<ListBoardsParams, ListBoardsResponse>(
  { expose: true, method: "GET", path: "/boards" },
  async (params) => {
    const limit = params.limit || 50;
    
    const boards = await boardDB.queryAll<Board>`
      SELECT id, name, created_at, updated_at, data
      FROM boards
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;

    return { boards };
  }
);
