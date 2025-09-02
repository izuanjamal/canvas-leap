import { api, APIError } from "encore.dev/api";
import { authDB } from "./db";
import type { LoginRequest, AuthResponse, AuthUser } from "./types";
import { signJWT } from "./jwt";
import bcrypt from "bcryptjs";

// Logs in an existing user with email/password and returns a JWT.
export const login = api<LoginRequest, AuthResponse>(
  { expose: true, method: "POST", path: "/auth/login" },
  async (req) => {
    const email = (req.email || "").trim().toLowerCase();
    const password = (req.password || "").trim();

    if (!email || !password) {
      throw APIError.invalidArgument("email and password are required");
    }

    const row = await authDB.queryRow<AuthUser & { password_hash: string }>`
      SELECT id, email, display_name, avatar_url, created_at, password_hash
      FROM auth_users
      WHERE email = ${email}
    `;
    if (!row) {
      throw APIError.unauthenticated("invalid credentials");
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      throw APIError.unauthenticated("invalid credentials");
    }

    const user: AuthUser = {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
    };

    const token = await signJWT({
      sub: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    });

    return { token, user };
  }
);
