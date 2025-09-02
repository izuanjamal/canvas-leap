import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eraser, Paintbrush, RotateCcw, RotateCw, Trash2, Download, Droplet } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#0ea5e9", // sky-500
  "#22c55e", // green-500
  "#ef4444", // red-500
  "#a855f7", // purple-500
  "#f59e0b", // amber-500
  "#111827", // gray-900
  "#ffffff", // white
  "#000000", // black
];

export type ToolKind = "pen" | "eraser";

interface DrawingToolbarProps {
  color: string;
  onColorChange: (color: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
  tool: ToolKind;
  onToolChange: (tool: ToolKind) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDownload: (format: "png" | "jpg") => void;
  // When false, editing actions are disabled (viewer mode)
  canEdit?: boolean;
}

export default function DrawingToolbar(props: DrawingToolbarProps) {
  const {
    color,
    onColorChange,
    size,
    onSizeChange,
    tool,
    onToolChange,
    onUndo,
    onRedo,
    onClear,
    onDownload,
    canEdit = true,
  } = props;

  const isLight = useMemo(() => {
    try {
      const c = color.replace("#", "");
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luminance > 180;
    } catch {
      return false;
    }
  }, [color]);

  return (
    <div className="pointer-events-auto rounded-xl border bg-card/80 backdrop-blur shadow-md p-2 flex items-center gap-2">
      {/* Tools */}
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant={tool === "pen" ? "default" : "secondary"}
          className={cn("size-9", tool === "pen" && "ring-2 ring-primary/60")}
          onClick={() => onToolChange("pen")}
          title="Pen"
          aria-label="Pen"
          disabled={!canEdit}
        >
          <Paintbrush className="size-5" />
        </Button>
        <Button
          size="icon"
          variant={tool === "eraser" ? "default" : "secondary"}
          className={cn("size-9", tool === "eraser" && "ring-2 ring-primary/60")}
          onClick={() => onToolChange("eraser")}
          title="Eraser"
          aria-label="Eraser"
          disabled={!canEdit}
        >
          <Eraser className="size-5" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border mx-1" />

      {/* Color */}
      <div className="flex items-center gap-2">
        <div
          className="h-6 w-6 rounded-full border shadow-inner"
          style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.25)"}` }}
          title="Current color"
          aria-label="Current color"
        />
        <div className="flex items-center gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={cn(
                "h-6 w-6 rounded-full border shadow transition hover:scale-105",
                c.toLowerCase() === color.toLowerCase() && "ring-2 ring-primary/60"
              )}
              style={{ backgroundColor: c }}
              onClick={() => onColorChange(c)}
              aria-label={`Preset color ${c}`}
              title={c}
              disabled={!canEdit}
            />
          ))}
          <label className={cn("h-6 w-8 rounded border bg-background inline-flex items-center justify-center", !canEdit && "opacity-50 cursor-not-allowed")} title="Custom color">
            <Droplet className="size-4 opacity-70" />
            <input
              type="color"
              className="sr-only"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              aria-label="Choose custom color"
              disabled={!canEdit}
            />
          </label>
        </div>
      </div>

      <div className="h-6 w-px bg-border mx-1" />

      {/* Brush size */}
      <div className="flex items-center gap-2">
        <div className="text-xs w-10 text-right tabular-nums">{size}px</div>
        <Slider
          value={[size]}
          min={1}
          max={32}
          step={1}
          className="w-36"
          onValueChange={(v) => onSizeChange(v[0] ?? size)}
          aria-label="Brush size"
          disabled={!canEdit}
        />
      </div>

      <div className="h-6 w-px bg-border mx-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button size="icon" variant="secondary" onClick={onUndo} title="Undo" aria-label="Undo" disabled={!canEdit}>
          <RotateCcw className="size-5" />
        </Button>
        <Button size="icon" variant="secondary" onClick={onRedo} title="Redo" aria-label="Redo" disabled={!canEdit}>
          <RotateCw className="size-5" />
        </Button>
        <Button size="icon" variant="secondary" onClick={onClear} title="Clear board" aria-label="Clear board" disabled={!canEdit}>
          <Trash2 className="size-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="secondary" title="Download" aria-label="Download">
              <Download className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDownload("png")}>Download PNG</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload("jpg")}>Download JPG</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
