import { api, APIError } from "encore.dev/api";
import { boardDB } from "./db";
import type { CreateUserRequest, User } from "./types";

// Creates a new user for collaborative whiteboard sessions.
// NOTE: This legacy endpoint is kept for backward compatibility but is no longer used after auth integration.
export const createUser = api<CreateUserRequest, User>(
  { expose: true, method: "POST", path: "/users" },
  async (req) => {
    try {
      const user = await boardDB.queryRow<User>`
        INSERT INTO users (username, color)
        VALUES (${req.username}, ${req.color || '#3B82F6'})
        RETURNING id, username, color
      `;

      if (!user) {
        throw new Error("Failed to create user");
      }

      return user;
    } catch (error: any) {
      if (error.code === '23505') { // PostgreSQL unique violation
        throw APIError.alreadyExists("Username already taken");
      }
      throw error;
    }
  }
);
