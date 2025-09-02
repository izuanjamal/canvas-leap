// The initial board ID to fetch from the backend (optional).
// If empty, the app will load a local sample board.
// TODO: Set this to an existing board ID from your database when ready.
export const initialBoardId = "";

// Google OAuth Client ID for PKCE flow (public identifier).
// TODO: Set this to your Google OAuth 2.0 Client ID from Google Cloud Console.
export const googleClientId = "";

// The redirect URI for Google OAuth that points back to the SPA.
// It must be registered in the Google Cloud Console for your OAuth client.
// Typically: `${window.location.origin}/oauth/callback`
export const oauthRedirectUri = typeof window !== "undefined" ? `${window.location.origin}/oauth/callback` : "/oauth/callback";
