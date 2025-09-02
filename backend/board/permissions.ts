import { APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { Role } from "./types";

export interface ShareTokenRecord {
  id: string;
  board_id: string;
  token: string;
  role: Exclude<Role, "owner">;
  enabled: boolean;
  created_at: Date;
  last_used_at?: Date | null;
}

function rank(role: Role): number {
  switch (role) {
    case "owner": return 3;
    case "editor": return 2;
    case "viewer": return 1;
    default: return 0;
  }
}

export async function getUserRole(boardId: string, userId: string): Promise<Role | null> {
  // Owner?
  const owner = await boardDB.queryRow<{ owner_id: string | null }>`
    SELECT owner_id FROM boards WHERE id = ${boardId}
  `;
  if (!owner) {
    throw APIError.notFound("board not found");
  }
  if (owner.owner_id && owner.owner_id === userId) {
    return "owner";
  }

  // Permission entry?
  const perm = await boardDB.queryRow<{ role: Role }>`
    SELECT role
    FROM board_permissions
    WHERE board_id = ${boardId} AND user_id = ${userId}
  `;
  if (!perm) return null;

  return perm.role;
}

export async function requireMinRole(boardId: string, userId: string, required: Role): Promise<Role> {
  const r = await getUserRole(boardId, userId);
  if (!r || rank(r) < rank(required)) {
    throw APIError.permissionDenied("insufficient permissions");
  }
  return r;
}

export async function getEnabledShareToken(boardId: string): Promise<ShareTokenRecord | null> {
  const tok = await boardDB.queryRow<ShareTokenRecord>`
    SELECT id, board_id, token, role, enabled, created_at, last_used_at
    FROM board_share_tokens
    WHERE board_id = ${boardId} AND enabled = TRUE
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return tok ?? null;
}

export async function setShareEnabled(boardId: string, role: Exclude<Role, "owner">): Promise<ShareTokenRecord> {
  const existing = await getEnabledShareToken(boardId);
  if (existing) {
    // Update role if changed
    if (existing.role !== role) {
      const updated = await boardDB.queryRow<ShareTokenRecord>`
        UPDATE board_share_tokens
        SET role = ${role}
        WHERE id = ${existing.id}
        RETURNING id, board_id, token, role, enabled, created_at, last_used_at
      `;
      return updated!;
    }
    return existing;
  }
  // Create new token
  const token = crypto.randomUUID();
  const rec = await boardDB.queryRow<ShareTokenRecord>`
    INSERT INTO board_share_tokens (board_id, token, role, enabled)
    VALUES (${boardId}, ${token}, ${role}, TRUE)
    RETURNING id, board_id, token, role, enabled, created_at, last_used_at
  `;
  if (!rec) throw APIError.internal("failed to create share token");
  return rec;
}

export async function rotateShareToken(boardId: string, role: Exclude<Role, "owner">): Promise<ShareTokenRecord> {
  // Disable existing and create a new one
  await boardDB.exec`
    UPDATE board_share_tokens
    SET enabled = FALSE
    WHERE board_id = ${boardId} AND enabled = TRUE
  `;
  return await setShareEnabled(boardId, role);
}

export async function disableShare(boardId: string): Promise<void> {
  await boardDB.exec`
    UPDATE board_share_tokens
    SET enabled = FALSE
    WHERE board_id = ${boardId} AND enabled = TRUE
  `;
}

export async function resolveShareToken(token: string): Promise<ShareTokenRecord | null> {
  const rec = await boardDB.queryRow<ShareTokenRecord>`
    SELECT id, board_id, token, role, enabled, created_at, last_used_at
    FROM board_share_tokens
    WHERE token = ${token}
  `;
  return rec ?? null;
}

export async function touchShareToken(id: string): Promise<void> {
  await boardDB.exec`
    UPDATE board_share_tokens
    SET last_used_at = NOW()
    WHERE id = ${id}
  `;
}
