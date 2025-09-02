import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "../state/authStore";

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await register(email, password, displayName);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Registration failed", err);
      alert("Registration failed");
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="w-full max-w-sm border rounded-lg p-6 bg-card shadow">
        <h1 className="text-xl font-semibold mb-4">Create your account</h1>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="display">Display name</Label>
            <Input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Jane Doe" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full mt-2">Sign up</Button>
        </form>
        <div className="text-sm text-muted-foreground mt-3">
          Already have an account? <Link to="/login" className="text-primary">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
