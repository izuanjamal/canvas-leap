import { Header, Cookie, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { authDB } from "./db";
import { verifyJWT } from "./jwt";

interface AuthParams {
  authorization?: Header<"Authorization">;
  session?: Cookie<"session">;
}

export interface AuthData {
  userID: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

const handler = authHandler<AuthParams, AuthData>(async (req) => {
  const authHeader = req.authorization ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const cookieToken = req.session?.value ?? null;
  const token = bearer || cookieToken;

  if (!token) {
    throw APIError.unauthenticated("missing bearer token or session cookie");
  }

  try {
    const { sub } = await verifyJWT(token);

    // Ensure the user exists; fetch minimal data
    const user = await authDB.queryRow<{
      id: string;
      email: string;
      display_name: string;
      avatar_url: string;
    }>`
      SELECT id, email, display_name, avatar_url
      FROM auth_users
      WHERE id = ${sub}
    `;
    if (!user) {
      throw APIError.unauthenticated("user not found");
    }

    return {
      userID: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    };
  } catch (err) {
    throw APIError.unauthenticated("invalid or expired token", err as Error);
  }
});

export const gw = new Gateway({ authHandler: handler });
