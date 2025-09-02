import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { authDB } from "./db";
import type { GoogleExchangeRequest, GoogleExchangeResponse, AuthUser } from "./types";
import { signJWT } from "./jwt";

const googleClientId = secret("GoogleClientID");
const googleClientSecret = secret("GoogleClientSecret");

// Exchanges a Google OAuth authorization code (with PKCE) for a JWT and user profile.
// The frontend should initiate the OAuth flow and handle the redirect to the frontend route,
// then call this endpoint with { code, code_verifier, redirect_uri }.
export const googleExchange = api<GoogleExchangeRequest, GoogleExchangeResponse>(
  { expose: true, method: "POST", path: "/auth/google/exchange" },
  async (req) => {
    if (!req.code || !req.code_verifier || !req.redirect_uri) {
      throw APIError.invalidArgument("code, code_verifier and redirect_uri are required");
    }

    // Exchange authorization code for tokens
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: req.redirect_uri,
        grant_type: "authorization_code",
        code_verifier: req.code_verifier,
      }),
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      throw APIError.unauthenticated("failed to exchange code with Google").withDetails({ body: txt });
    }

    const tokenData: any = await tokenResp.json();
    const accessToken: string = tokenData.access_token;
    if (!accessToken) {
      throw APIError.unauthenticated("missing access token from Google");
    }

    // Fetch user info
    const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoResp.ok) {
      throw APIError.unauthenticated("failed to fetch user info from Google");
    }

    const profile: any = await userInfoResp.json();
    const email: string = (profile.email || "").toLowerCase().trim();
    const displayName: string = profile.name || email.split("@")[0] || "User";
    const avatarUrl: string = profile.picture || "";

    if (!email) {
      throw APIError.unauthenticated("Google account has no email");
    }

    // Upsert user
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
      // Optionally update display_name/avatar_url
      const updated = await authDB.queryRow<AuthUser>`
        UPDATE auth_users
        SET display_name = ${displayName}, avatar_url = ${avatarUrl}
        WHERE id = ${user.id}
        RETURNING id, email, display_name, avatar_url, created_at
      `;
      if (updated) user = updated;
    }

    const token = await signJWT({
      sub: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    });

    return { token, user };
  }
);
