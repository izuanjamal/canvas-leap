import React from "react";
import { ZoomControls } from "./ZoomControls";
import { useAuthStore } from "../state/authStore";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarStack } from "./AvatarStack";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initials = user?.display_name
    ? user.display_name.split(" ").map((p) => p[0]?.toUpperCase()).slice(0, 2).join("")
    : "U";

  return (
    <div className="h-12 flex items-center justify-between px-3 border-b bg-card/60 backdrop-blur">
      <div className="font-medium text-sm">{title}</div>
      <div className="flex items-center gap-3">
        <ZoomControls />
        <div className="h-6 w-px bg-border" />
        <AvatarStack />
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarImage src={user?.avatar_url || ""} alt={user?.display_name || ""} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="text-xs">{user?.display_name || user?.email || "User"}</div>
          <Button size="sm" variant="secondary" onClick={logout}>Logout</Button>
        </div>
      </div>
    </div>
  );
}
