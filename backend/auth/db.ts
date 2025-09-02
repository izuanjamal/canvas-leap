import { SQLDatabase } from "encore.dev/storage/sqldb";

// Use the same database as the board service.
export const authDB = SQLDatabase.named("canvas_leap");
