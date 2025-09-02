import React from "react";
import { ZoomControls } from "./ZoomControls";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  return (
    <div className="h-12 flex items-center justify-between px-3 border-b bg-card/60 backdrop-blur">
      <div className="font-medium text-sm">{title}</div>
      <ZoomControls />
    </div>
  );
}
