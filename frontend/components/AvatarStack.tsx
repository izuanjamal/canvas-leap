import React, { useMemo } from "react";
import { useCanvasStore } from "../state/canvasStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AvatarStack() {
  const cursors = useCanvasStore((s) => s.cursors);

  const users = useMemo(() => {
    // Deduplicate by user id
    const map = new Map<string, { id: string; name: string; avatarUrl?: string }>();
    for (const c of cursors) {
      map.set(c.id, { id: c.id, name: c.name, avatarUrl: c.avatarUrl });
    }
    return Array.from(map.values());
  }, [cursors]);

  if (users.length === 0) {
    return <div className="text-xs text-muted-foreground">No active users</div>;
  }

  return (
    <div className="flex -space-x-2 items-center">
      {users.map((u) => {
        const initials = u.name
          ? u.name.split(" ").map((p) => p[0]?.toUpperCase()).slice(0, 2).join("")
          : "U";
        return (
          <div key={u.id} className="relative">
            <Avatar className="size-8 ring-2 ring-background shadow-md">
              <AvatarImage src={u.avatarUrl || ""} alt={u.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </div>
        );
      })}
      <div className="ml-3 text-xs text-muted-foreground">{users.length} online</div>
    </div>
  );
}
