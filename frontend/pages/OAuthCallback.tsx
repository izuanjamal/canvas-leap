import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import backend from "~backend/client";
import { useAuthStore } from "../state/authStore";

export function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    (async () => {
      const code = params.get("code") || "";
      const verifier = sessionStorage.getItem("pkce_verifier") || "";
      const redirectUri = sessionStorage.getItem("oauth_redirect_uri") || window.location.origin + "/oauth/callback";
      sessionStorage.removeItem("pkce_verifier");
      sessionStorage.removeItem("oauth_redirect_uri");
      if (!code || !verifier) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const resp = await backend.auth.googleExchange({
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
        });
        setAuth(resp.token, resp.user);
        navigate("/", { replace: true });
      } catch (err) {
        console.error("Google OAuth exchange failed", err);
        alert("Google login failed");
        navigate("/login", { replace: true });
      }
    })();
  }, [params, navigate, setAuth]);

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-sm">Completing sign-in…</div>
    </div>
  );
}
