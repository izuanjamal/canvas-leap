import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { UpdatePermissionsRequest, UpdatePermissionsResponse, BoardPermission } from "./types";
import { getAuthData } from "~encore/auth";
import { requireMinRole } from "./permissions";

// Updates or creates a user permission for a board. Only the owner can manage permissions.
export const updatePermissions = api<UpdatePermissionsRequest, UpdatePermissionsResponse>(
  { expose: true, method: "PATCH", path: "/boards/:id/permissions", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await requireMinRole(req.id, auth.userID, "owner");

    let userId = req.user_id || null;

    if (!userId && req.email) {
      const row = await boardDB.queryRow<{ id: string }>`
        SELECT id FROM auth_users WHERE email = ${req.email.toLowerCase().trim()}
      `;
      if (!row) {
        throw APIError.notFound("user with given email not found");
      }
      userId = row.id;
    }

    if (!userId) {
      throw APIError.invalidArgument("user_id or email is required");
    }

    if (!["owner", "editor", "viewer"].includes(req.role)) {
      throw APIError.invalidArgument("invalid role");
    }

    // Prevent demoting the current owner via permissions table
    const owner = await boardDB.queryRow<{ owner_id: string | null }>`
      SELECT owner_id FROM boards WHERE id = ${req.id}
    `;
    if (!owner) throw APIError.notFound("board not found");
    if (owner.owner_id === userId && req.role !== "owner") {
      throw APIError.failedPrecondition("cannot change owner's role via permissions");
    }

    const perm = await boardDB.queryRow<BoardPermission>`
      INSERT INTO board_permissions (board_id, user_id, role)
      VALUES (${req.id}, ${userId}, ${req.role})
      ON CONFLICT (board_id, user_id)
      DO UPDATE SET role = EXCLUDED.role
      RETURNING id, board_id, user_id, role, created_at
    `;

    if (!perm) throw APIError.internal("failed to upsert permission");
    return { permission: perm };
  }
);
