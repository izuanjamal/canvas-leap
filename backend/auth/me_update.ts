import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import type { UpdateMeRequest, MeResponse, AuthUser } from "./types";
import { getAuthData } from "~encore/auth";

// Updates the authenticated user's profile (display_name, avatar_url).
export const updateMe = api<UpdateMeRequest, MeResponse>(
  { expose: true, method: "PATCH", path: "/me", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    if (!req.display_name && !req.avatar_url) {
      throw APIError.invalidArgument("nothing to update");
    }

    const user = await authDB.queryRow<AuthUser>`
      UPDATE auth_users
      SET
        display_name = COALESCE(${req.display_name ?? null}, display_name),
        avatar_url   = COALESCE(${req.avatar_url ?? null}, avatar_url)
      WHERE id = ${auth.userID}
      RETURNING id, email, display_name, avatar_url, created_at
    `;
    if (!user) {
      throw APIError.notFound("user not found");
    }
    return { user };
  }
);
