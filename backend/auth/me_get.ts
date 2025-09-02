import { api } from "encore.dev/api";
import { authDB } from "./db";
import type { MeResponse, AuthUser } from "./types";
import { getAuthData } from "~encore/auth";

// Returns the current authenticated user.
export const me = api<void, MeResponse>(
  { expose: true, method: "GET", path: "/me", auth: true },
  async () => {
    const auth = getAuthData()!;
    const user = await authDB.queryRow<AuthUser>`
      SELECT id, email, display_name, avatar_url, created_at
      FROM auth_users
      WHERE id = ${auth.userID}
    `;
    if (!user) {
      throw new Error("user not found");
    }
    return { user };
  }
);
