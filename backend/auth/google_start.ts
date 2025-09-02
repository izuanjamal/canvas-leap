import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const googleClientId = secret("GoogleClientID");

interface GoogleStartRequest {
  // The redirect URI registered in Google Console, e.g. https://yourapp.com/auth/callback/google
  redirect_uri: string;
  // Optional: PKCE code challenge (S256). If provided, `code_challenge_method=S256` is included.
  code_challenge?: string;
  // Optional: state to round-trip, else a random one is generated.
  state?: string;
}

interface GoogleStartResponse {
  url: string;
  state: string;
}

// Starts the Google OAuth flow by generating an authorization URL.
export const googleStart = api<GoogleStartRequest, GoogleStartResponse>(
  { expose: true, method: "POST", path: "/auth/google" },
  async (req) => {
    const redirectURI = (req.redirect_uri || "").trim();
    if (!redirectURI) {
      throw APIError.invalidArgument("redirect_uri is required");
    }

    const state = req.state || crypto.randomUUID();
    const params = new URLSearchParams({
      client_id: googleClientId(),
      response_type: "code",
      redirect_uri: redirectURI,
      scope: "openid email profile",
      include_granted_scopes: "true",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    if (req.code_challenge) {
      params.set("code_challenge_method", "S256");
      params.set("code_challenge", req.code_challenge);
    }

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return { url, state };
  }
);
