import { api, APIError, Cookie, Query } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { OAuth2Client } from "google-auth-library";
import { authDB } from "./db";
import type { AuthUser } from "./types";
import { signJWT } from "./jwt";

const googleClientId = secret("GoogleClientID");
const googleClientSecret = secret("GoogleClientSecret");

interface GoogleCallbackRequest {
  code: Query<string>;
  code_verifier: Query<string>;
  redirect_uri: Query<string>;
}

interface GoogleCallbackResponse {
  user: AuthUser;
  token: string;
  session: Cookie<"session">;
}

// Handles Google OAuth callback by exchanging the code for tokens, verifying the ID token,
// upserting the user, issuing a JWT and setting it as an HttpOnly cookie.
export const googleCallback = api<GoogleCallbackRequest, GoogleCallbackResponse>(
  { expose: true, method: "GET", path: "/auth/callback/google" },
  async (req) => {
    const code = (req.code || "").trim();
    const codeVerifier = (req.code_verifier || "").trim();
    const redirectURI = (req.redirect_uri || "").trim();

    if (!code || !codeVerifier || !redirectURI) {
      throw APIError.invalidArgument("code, code_verifier and redirect_uri are required");
    }

    // Exchange authorization code for tokens
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: redirectURI,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      throw APIError.unauthenticated("failed to exchange code with Google").withDetails({ body: txt });
    }

    const tokenData: any = await tokenResp.json();
    const idToken: string | undefined = tokenData.id_token;
    const accessToken: string | undefined = tokenData.access_token;

    if (!idToken) {
      throw APIError.unauthenticated("missing id_token from Google");
    }

    // Verify the ID token
    const client = new OAuth2Client(googleClientId());
    const ticket = await client.verifyIdToken({
      idToken,
      audience: googleClientId(),
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw APIError.unauthenticated("invalid id token payload");
    }

    const email = (payload.email || "").toLowerCase().trim();
    const displayName = payload.name || email.split("@")[0] || "User";
    const avatarUrl = payload.picture || "";

    if (!email) {
      throw APIError.unauthenticated("Google account has no email");
    }

    // Upsert user in auth_users
    let user = await authDB.queryRow<AuthUser>`
      SELECT id, email, display_name, avatar_url, created_at
      FROM auth_users
      WHERE email = ${email}
    `;

    if (!user) {
      user = await authDB.queryRow<AuthUser>`
        INSERT INTO auth_users (email, password_hash, display_name, avatar_url)
        VALUES (${email}, ${""}, ${displayName}, ${avatarUrl})
        RETURNING id, email, display_name, avatar_url, created_at
      `;
      if (!user) {
        throw APIError.internal("failed to create user");
      }
    } else {
      const updated = await authDB.queryRow<AuthUser>`
        UPDATE auth_users
        SET display_name = ${displayName}, avatar_url = ${avatarUrl}
        WHERE id = ${user.id}
        RETURNING id, email, display_name, avatar_url, created_at
      `;
      if (updated) user = updated;
    }

    // Issue our own session JWT
    const token = await signJWT({
      sub: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    });

    // Set HttpOnly session cookie
    const sessionCookie: Cookie<"session"> = {
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
    };

    return { user, token, session: sessionCookie };
  }
);
