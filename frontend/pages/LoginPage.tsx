import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "../state/authStore";
import { generatePKCE } from "../utils/pkce";
import { googleClientId, oauthRedirectUri } from "../config";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Login failed", err);
      alert("Login failed");
    }
  }

  async function onGoogle() {
    const { verifier, challenge } = await generatePKCE();
    sessionStorage.setItem("pkce_verifier", verifier);
    sessionStorage.setItem("oauth_redirect_uri", oauthRedirectUri);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", googleClientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", oauthRedirectUri);
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", challenge);
    window.location.href = url.toString();
  }

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="w-full max-w-sm border rounded-lg p-6 bg-card shadow">
        <h1 className="text-xl font-semibold mb-4">Sign in to CanvasLeap</h1>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full mt-2">Sign in</Button>
        </form>
        <Button variant="secondary" className="w-full mt-3" onClick={onGoogle}>
          Continue with Google
        </Button>
        <div className="text-sm text-muted-foreground mt-3">
          Don&apos;t have an account? <Link to="/register" className="text-primary">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
