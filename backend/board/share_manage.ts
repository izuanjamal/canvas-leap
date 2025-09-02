import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { ShareManageRequest, ShareManageResponse } from "./types";
import { requireMinRole, setShareEnabled, disableShare, rotateShareToken, getEnabledShareToken } from "./permissions";

// Enables, disables, or rotates the public share link for a board.
// Only the owner can manage sharing.
export const manageShare = api<ShareManageRequest, ShareManageResponse>(
  { expose: true, method: "POST", path: "/boards/:id/share", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    // Owner required
    await requireMinRole(req.id, auth.userID, "owner");

    const action = req.action;
    const role = (req.role ?? "viewer") as "viewer" | "editor";

    switch (action) {
      case "enable": {
        const rec = await setShareEnabled(req.id, role);
        return { status: "enabled", token: rec.token, role: rec.role };
      }
      case "rotate": {
        const rec = await rotateShareToken(req.id, role);
        return { status: "enabled", token: rec.token, role: rec.role };
      }
      case "disable": {
        await disableShare(req.id);
        return { status: "disabled" };
      }
      case "status": {
        const rec = await getEnabledShareToken(req.id);
        if (!rec) return { status: "disabled" };
        return { status: "enabled", token: rec.token, role: rec.role };
      }
      default:
        throw APIError.invalidArgument("invalid action");
    }
  }
);
