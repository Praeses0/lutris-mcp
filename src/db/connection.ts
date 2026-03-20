import Database from "better-sqlite3";
import { homedir } from "os";
import { existsSync } from "fs";
import path from "path";

let db: Database.Database | null = null;

export function getDbPath(): string {
  return (
    process.env.LUTRIS_DB_PATH ||
    path.join(homedir(), ".local", "share", "lutris", "pga.db")
  );
}

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    throw new Error(`Lutris database not found at ${dbPath}`);
  }

  db = new Database(dbPath, { readonly: false });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  process.on("exit", () => {
    if (db) {
      db.close();
      db = null;
    }
  });

  return db;
}
