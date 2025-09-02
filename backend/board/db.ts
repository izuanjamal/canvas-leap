import { SQLDatabase } from "encore.dev/storage/sqldb";

export const boardDB = new SQLDatabase("canvas_leap", {
  migrations: "./migrations",
});
