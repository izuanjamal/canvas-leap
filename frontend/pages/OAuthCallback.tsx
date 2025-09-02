import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import backend from "~backend/client";
import { useAuthStore } from "../state/authStore";

export function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    (async () => {
      const code = params.get("code") || "";
      const verifier = sessionStorage.getItem("pkce_verifier") || "";
      const redirectUri = sessionStorage.getItem("oauth_redirect_uri") || window.location.origin + "/auth/callback/google";
      // Clean up PKCE/session storage
      sessionStorage.removeItem("pkce_verifier");
      sessionStorage.removeItem("oauth_redirect_uri");
      if (!code || !verifier) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        // Exchange code on the backend (sets HttpOnly session cookie)
        const resp = await backend.auth.googleCallback({
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
        });
        // For backward-compat, also set token in client store; cookie is primary for auth.
        setAuth(resp.token, resp.user);
        // Hydrate user from session cookie (ensures future requests work without header)
        await checkSession();
        navigate("/", { replace: true });
      } catch (err) {
        console.error("Google OAuth exchange failed", err);
        alert("Google login failed");
        navigate("/login", { replace: true });
      }
    })();
  }, [params, navigate, setAuth, checkSession]);

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-sm">Completing sign-in…</div>
    </div>
  );
}
