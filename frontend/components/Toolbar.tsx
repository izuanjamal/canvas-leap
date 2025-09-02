import React from "react";
import { Button } from "@/components/ui/button";
import { MousePointer, Pencil, Eraser, Type, StickyNote } from "lucide-react";
import { useCanvasStore } from "../state/canvasStore";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export function Toolbar() {
  const tool = useCanvasStore((s) => s.tool);
  const setTool = useCanvasStore((s) => s.setTool);
  const { toast } = useToast();

  const handleSetTool = (t: typeof tool) => {
    setTool(t);
    if (t === "draw" || t === "erase") {
      toast({
        title: t === "draw" ? "Draw tool coming soon" : "Erase tool coming soon",
        description: "This is a placeholder. Vector drawing and eraser will be implemented next.",
      });
    }
  };

  return (
    <div className="w-14 border-r bg-card/60 backdrop-blur flex flex-col items-center py-2 gap-2">
      <ToolButton
        label="Select (V)"
        active={tool === "select"}
        onClick={() => handleSetTool("select")}
      >
        <MousePointer className="size-5" />
      </ToolButton>
      <ToolButton
        label="Draw (B)"
        active={tool === "draw"}
        onClick={() => handleSetTool("draw")}
      >
        <Pencil className="size-5" />
      </ToolButton>
      <ToolButton
        label="Erase (E)"
        active={tool === "erase"}
        onClick={() => handleSetTool("erase")}
      >
        <Eraser className="size-5" />
      </ToolButton>
      <div className="h-px w-8 bg-border my-1" />
      <ToolButton
        label="Text (T)"
        active={tool === "text"}
        onClick={() => handleSetTool("text")}
      >
        <Type className="size-5" />
      </ToolButton>
      <ToolButton
        label="Sticky (N)"
        active={tool === "sticky"}
        onClick={() => handleSetTool("sticky")}
      >
        <StickyNote className="size-5" />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="icon"
      variant={active ? "default" : "secondary"}
      className={cn("size-10", active && "ring-2 ring-primary/60")}
      onClick={onClick}
      title={label}
    >
      {children}
    </Button>
  );
}
