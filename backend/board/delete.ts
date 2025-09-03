import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import { getAuthData } from "~encore/auth";
import { requireMinRole } from "./permissions";

interface DeleteBoardParams {
  id: string;
}

// Deletes a board. Only the owner can delete a board.
export const deleteBoard = api<DeleteBoardParams, void>(
  { expose: true, method: "DELETE", path: "/boards/:id", auth: true },
  async (params) => {
    const auth = getAuthData()!;
    await requireMinRole(params.id, auth.userID, "owner");

    const row = await boardDB.queryRow<{ id: string }>`
      SELECT id FROM boards WHERE id = ${params.id}
    `;
    if (!row) {
      throw APIError.notFound("board not found");
    }

    await boardDB.exec`
      DELETE FROM boards WHERE id = ${params.id}
    `;
  }
);
