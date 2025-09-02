import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { Stroke } from "./types";
import { getAuthData } from "~encore/auth";

export interface CreateStrokeRequest {
  board_id: string;
  // Expected format from frontend WhiteboardCanvas: { points: {x:number, y:number}[], mode?: "draw" | "erase" }
  path_data: Record<string, any>;
  color: string;
  thickness: number;
}

export interface CreateStrokeResponse {
  stroke: Stroke;
}

// Saves a new stroke to the board.
export const createStroke = api<CreateStrokeRequest, CreateStrokeResponse>(
  { expose: true, method: "POST", path: "/strokes", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    if (!req.board_id) throw APIError.invalidArgument("board_id is required");
    if (!req.path_data || !Array.isArray(req.path_data.points)) {
      throw APIError.invalidArgument("path_data.points must be an array");
    }
    const color = (req.color || "#000000").trim();
    const thickness = Number.isFinite(req.thickness) ? Math.max(1, Math.min(64, Math.floor(req.thickness))) : 2;

    const stroke = await boardDB.queryRow<Stroke>`
      INSERT INTO strokes (board_id, user_id, path_data, color, thickness)
      VALUES (${req.board_id}, ${auth.userID}, ${JSON.stringify(req.path_data)}, ${color}, ${thickness})
      RETURNING id, board_id, user_id, path_data, color, thickness, created_at
    `;

    if (!stroke) {
      throw APIError.internal("failed to create stroke");
    }

    return { stroke };
  }
);
