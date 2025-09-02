import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "../state/authStore";
import { generatePKCE } from "../utils/pkce";
import { oauthRedirectUri } from "../config";
import backend from "~backend/client";

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
    try {
      const { verifier, challenge } = await generatePKCE();
      sessionStorage.setItem("pkce_verifier", verifier);
      sessionStorage.setItem("oauth_redirect_uri", oauthRedirectUri);
      // Ask backend to construct the Google auth URL (keeps server-side config centralized)
      const { url, state } = await backend.auth.googleStart({
        redirect_uri: oauthRedirectUri,
        code_challenge: challenge,
      });
      sessionStorage.setItem("oauth_state", state);
      window.location.href = url;
    } catch (err) {
      console.error("Failed initiating Google OAuth", err);
      alert("Could not start Google sign-in");
    }
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
