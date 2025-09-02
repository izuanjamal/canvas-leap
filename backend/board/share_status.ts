import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { ShareStatusParams, ShareStatusResponse } from "./types";
import { requireMinRole, getEnabledShareToken } from "./permissions";

// Retrieves the current sharing status for a board.
// Only the owner can query this.
export const shareStatus = api<ShareStatusParams, ShareStatusResponse>(
  { expose: true, method: "GET", path: "/boards/:id/share", auth: true },
  async (params) => {
    const auth = getAuthData()!;
    await requireMinRole(params.id, auth.userID, "owner");

    const rec = await getEnabledShareToken(params.id);
    if (!rec) {
      return { enabled: false };
    }
    return { enabled: true, token: rec.token, role: rec.role };
  }
);
