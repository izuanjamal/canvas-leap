import { api, APIError, Cookie } from "encore.dev/api";
import { authDB } from "./db";
import type { RegisterRequest, AuthUser } from "./types";
import { signJWT } from "./jwt";
import bcrypt from "bcryptjs";

interface RegisterResponse {
  token: string;
  user: AuthUser;
  session: Cookie<"session">;
}

// Registers a new user with email/password and returns a JWT, also setting an HttpOnly session cookie.
export const register = api<RegisterRequest, RegisterResponse>(
  { expose: true, method: "POST", path: "/auth/register" },
  async (req) => {
    const email = (req.email || "").trim().toLowerCase();
    const password = (req.password || "").trim();
    const display = (req.display_name || "").trim();

    if (!email || !password) {
      throw APIError.invalidArgument("email and password are required");
    }
    if (password.length < 8) {
      throw APIError.invalidArgument("password must be at least 8 characters");
    }

    const hash = await bcrypt.hash(password, 10);

    try {
      const user = await authDB.queryRow<AuthUser>`
        INSERT INTO auth_users (email, password_hash, display_name, avatar_url)
        VALUES (${email}, ${hash}, ${display || email.split("@")[0]}, ${""})
        RETURNING id, email, display_name, avatar_url, created_at
      `;
      if (!user) {
        throw APIError.internal("failed to create user");
      }
      const token = await signJWT({
        sub: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      });

      const session: Cookie<"session"> = {
        value: token,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      };

      return { token, user, session };
    } catch (err: any) {
      if (err.code === "23505") {
        throw APIError.alreadyExists("email already registered");
      }
      throw err;
    }
  }
);
