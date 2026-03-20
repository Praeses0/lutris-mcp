import { getDatabase } from "./connection.js";
import type {
  Game,
  ServiceGame,
  Category,
  CategoryWithCount,
  GameCategory,
} from "./types.js";

// ─── Games ───────────────────────────────────────────────────────────────────

export interface ListGamesOptions {
  runner?: string;
  platform?: string;
  installed?: boolean;
  category?: string;
  search?: string;
  smart_search?: boolean;
  service?: string;
  limit: number;
  offset: number;
  sort_by: string;
  sort_order: "asc" | "desc";
}

const ALLOWED_SORT_COLUMNS = new Set([
  "name",
  "sortname",
  "playtime",
  "lastplayed",
  "installed_at",
  "year",
  "updated",
]);

export function listGames(opts: ListGamesOptions): { games: Game[]; total: number } {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (opts.runner) {
    conditions.push("g.runner = :runner");
    params.runner = opts.runner;
  }
  if (opts.platform) {
    conditions.push("g.platform = :platform");
    params.platform = opts.platform;
  }
  if (opts.installed !== undefined) {
    conditions.push("g.installed = :installed");
    params.installed = opts.installed ? 1 : 0;
  }
  if (opts.service) {
    conditions.push("g.service = :service");
    params.service = opts.service;
  }
  if (opts.search) {
    if (opts.smart_search) {
      // Smart search: split into tokens by whitespace and special chars, match each
      // e.g., "witcher 3" → ["witcher", "3"], "half-life" → ["half", "life"]
      const tokens = opts.search
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
      if (tokens.length === 0) {
        conditions.push("1 = 0"); // no valid tokens → no results
      }
      tokens.forEach((token, i) => {
        const key = `search_${i}`;
        conditions.push(`(LOWER(g.name) LIKE :${key} OR g.slug LIKE :${key})`);
        params[key] = `%${token}%`;
      });
    } else {
      conditions.push("(g.name LIKE :search OR g.slug LIKE :search)");
      params.search = `%${opts.search}%`;
    }
  }

  let joins = "";
  if (opts.category) {
    joins =
      "JOIN games_categories gc ON gc.game_id = g.id JOIN categories c ON c.id = gc.category_id";
    conditions.push("c.name = :category");
    params.category = opts.category;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortCol = ALLOWED_SORT_COLUMNS.has(opts.sort_by) ? opts.sort_by : "name";
  const sortDir = opts.sort_order === "desc" ? "DESC" : "ASC";

  const countRow = db
    .prepare(`SELECT COUNT(DISTINCT g.id) as count FROM games g ${joins} ${where}`)
    .get(params) as { count: number };

  const games = db
    .prepare(
      `SELECT DISTINCT g.* FROM games g ${joins} ${where} ORDER BY g.${sortCol} ${sortDir} LIMIT :limit OFFSET :offset`
    )
    .all({ ...params, limit: opts.limit, offset: opts.offset }) as Game[];

  return { games, total: countRow.count };
}

export function getGameById(id: number): Game | undefined {
  const db = getDatabase();
  return db.prepare("SELECT * FROM games WHERE id = ?").get(id) as Game | undefined;
}

export function getGameBySlug(slug: string): Game | undefined {
  const db = getDatabase();
  return db.prepare("SELECT * FROM games WHERE slug = ?").get(slug) as Game | undefined;
}

export function getGameCategories(gameId: number): Category[] {
  const db = getDatabase();
  return db
    .prepare(
      "SELECT c.* FROM categories c JOIN games_categories gc ON gc.category_id = c.id WHERE gc.game_id = ?"
    )
    .all(gameId) as Category[];
}

export function insertGame(game: Partial<Game>): Game {
  const db = getDatabase();
  const fields = Object.keys(game);
  const placeholders = fields.map((f) => `:${f}`).join(", ");
  const stmt = db.prepare(
    `INSERT INTO games (${fields.join(", ")}) VALUES (${placeholders})`
  );
  const result = stmt.run(game as Record<string, unknown>);
  return getGameById(result.lastInsertRowid as number)!;
}

export function updateGame(
  id: number,
  updates: Partial<Omit<Game, "id">>
): Game | undefined {
  const db = getDatabase();
  const fields = Object.keys(updates);
  if (fields.length === 0) return getGameById(id);

  const sets = fields.map((f) => `${f} = :${f}`).join(", ");
  db.prepare(`UPDATE games SET ${sets} WHERE id = :id`).run({
    ...updates,
    id,
  } as Record<string, unknown>);
  return getGameById(id);
}

export function deleteGame(id: number): boolean {
  const db = getDatabase();
  db.prepare("DELETE FROM games_categories WHERE game_id = ?").run(id);
  const result = db.prepare("DELETE FROM games WHERE id = ?").run(id);
  return result.changes > 0;
}

// ─── Categories ──────────────────────────────────────────────────────────────

export function listCategories(): CategoryWithCount[] {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT c.id, c.name, COUNT(gc.game_id) as game_count
       FROM categories c
       LEFT JOIN games_categories gc ON gc.category_id = c.id
       GROUP BY c.id, c.name
       ORDER BY c.name`
    )
    .all() as CategoryWithCount[];
}

export function createCategory(name: string): Category {
  const db = getDatabase();
  const result = db
    .prepare("INSERT INTO categories (name) VALUES (?)")
    .run(name);
  return { id: result.lastInsertRowid as number, name };
}

export function getCategoryByName(name: string): Category | undefined {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM categories WHERE name = ?")
    .get(name) as Category | undefined;
}

export function assignCategory(gameId: number, categoryId: number): void {
  const db = getDatabase();
  db.prepare(
    "INSERT OR IGNORE INTO games_categories (game_id, category_id) VALUES (?, ?)"
  ).run(gameId, categoryId);
}

export function unassignCategory(gameId: number, categoryId: number): boolean {
  const db = getDatabase();
  const result = db
    .prepare(
      "DELETE FROM games_categories WHERE game_id = ? AND category_id = ?"
    )
    .run(gameId, categoryId);
  return result.changes > 0;
}

// ─── Service Games ───────────────────────────────────────────────────────────

export interface SearchServiceGamesOptions {
  query?: string;
  service: string;
  limit: number;
  offset: number;
}

export function searchServiceGames(
  opts: SearchServiceGamesOptions
): { games: ServiceGame[]; total: number } {
  const db = getDatabase();
  const conditions: string[] = ["service = :service"];
  const params: Record<string, unknown> = { service: opts.service };

  if (opts.query) {
    conditions.push("(name LIKE :query OR appid LIKE :query)");
    params.query = `%${opts.query}%`;
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const countRow = db
    .prepare(`SELECT COUNT(*) as count FROM service_games ${where}`)
    .get(params) as { count: number };

  const games = db
    .prepare(
      `SELECT * FROM service_games ${where} ORDER BY name ASC LIMIT :limit OFFSET :offset`
    )
    .all({ ...params, limit: opts.limit, offset: opts.offset }) as ServiceGame[];

  return { games, total: countRow.count };
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface LibraryStats {
  total_games: number;
  installed_games: number;
  total_playtime_hours: number;
  top_games_by_playtime: { name: string; playtime: number }[];
  games_by_runner: { runner: string; count: number }[];
  games_by_platform: { platform: string; count: number }[];
  games_by_service: { service: string; count: number }[];
  recently_played: { name: string; lastplayed: number }[];
}

export function getLibraryStats(): LibraryStats {
  const db = getDatabase();

  const totals = db
    .prepare(
      "SELECT COUNT(*) as total, SUM(CASE WHEN installed = 1 THEN 1 ELSE 0 END) as installed, COALESCE(SUM(playtime), 0) as playtime FROM games"
    )
    .get() as { total: number; installed: number; playtime: number };

  const topByPlaytime = db
    .prepare(
      "SELECT name, playtime FROM games WHERE playtime > 0 ORDER BY playtime DESC LIMIT 10"
    )
    .all() as { name: string; playtime: number }[];

  const byRunner = db
    .prepare(
      "SELECT COALESCE(runner, 'unknown') as runner, COUNT(*) as count FROM games GROUP BY runner ORDER BY count DESC"
    )
    .all() as { runner: string; count: number }[];

  const byPlatform = db
    .prepare(
      "SELECT COALESCE(platform, 'unknown') as platform, COUNT(*) as count FROM games GROUP BY platform ORDER BY count DESC"
    )
    .all() as { platform: string; count: number }[];

  const byService = db
    .prepare(
      "SELECT COALESCE(service, 'none') as service, COUNT(*) as count FROM games GROUP BY service ORDER BY count DESC"
    )
    .all() as { service: string; count: number }[];

  const recentlyPlayed = db
    .prepare(
      "SELECT name, lastplayed FROM games WHERE lastplayed IS NOT NULL AND lastplayed > 0 ORDER BY lastplayed DESC LIMIT 10"
    )
    .all() as { name: string; lastplayed: number }[];

  return {
    total_games: totals.total,
    installed_games: totals.installed,
    total_playtime_hours: Math.round((totals.playtime / 60) * 100) / 100,
    top_games_by_playtime: topByPlaytime,
    games_by_runner: byRunner,
    games_by_platform: byPlatform,
    games_by_service: byService,
    recently_played: recentlyPlayed,
  };
}

// ─── Additional Queries ─────────────────────────────────────────────────────

export function getServiceGame(
  service: string,
  appid: string
): ServiceGame | undefined {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM service_games WHERE service = ? AND appid = ?")
    .get(service, appid) as ServiceGame | undefined;
}

export function getAllGames(): Game[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM games ORDER BY name").all() as Game[];
}

export function getAllGameCategories(): GameCategory[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM games_categories")
    .all() as GameCategory[];
}

export function bulkAssignCategory(
  gameIds: number[],
  categoryId: number
): number {
  const db = getDatabase();
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO games_categories (game_id, category_id) VALUES (?, ?)"
  );
  const txn = db.transaction((ids: number[]) => {
    let count = 0;
    for (const id of ids) {
      const result = stmt.run(id, categoryId);
      count += result.changes;
    }
    return count;
  });
  return txn(gameIds);
}

const BULK_UPDATE_FIELDS = new Set([
  "runner",
  "platform",
  "installed",
  "year",
  "service",
  "sortname",
]);

export function bulkUpdateGames(
  gameIds: number[],
  field: string,
  value: unknown
): number {
  if (!BULK_UPDATE_FIELDS.has(field)) {
    throw new Error(`Field "${field}" is not allowed for bulk update`);
  }
  const db = getDatabase();
  const stmt = db.prepare(`UPDATE games SET ${field} = ? WHERE id = ?`);
  const txn = db.transaction((ids: number[]) => {
    let count = 0;
    for (const id of ids) {
      const result = stmt.run(value, id);
      count += result.changes;
    }
    return count;
  });
  return txn(gameIds);
}

export interface DuplicateGroup {
  reason: string;
  games: Pick<Game, "id" | "name" | "slug" | "directory" | "runner">[];
}

export function findDuplicates(): DuplicateGroup[] {
  const db = getDatabase();
  const groups: DuplicateGroup[] = [];

  const allGames = db
    .prepare(
      "SELECT id, name, slug, directory, runner FROM games ORDER BY slug"
    )
    .all() as Pick<Game, "id" | "name" | "slug" | "directory" | "runner">[];

  // Group by same non-empty directory
  const dirMap = new Map<string, typeof allGames>();
  for (const g of allGames) {
    if (!g.directory) continue;
    if (!dirMap.has(g.directory)) dirMap.set(g.directory, []);
    dirMap.get(g.directory)!.push(g);
  }
  for (const [dir, games] of dirMap) {
    if (games.length > 1) {
      groups.push({ reason: `Same directory: ${dir}`, games });
    }
  }

  // Find similar slugs (one is substring of another)
  const seenPairs = new Set<string>();
  for (let i = 0; i < allGames.length; i++) {
    for (let j = i + 1; j < allGames.length; j++) {
      const a = allGames[i];
      const b = allGames[j];
      if (!a.slug || !b.slug || a.slug === b.slug) continue;
      if (a.slug.includes(b.slug) || b.slug.includes(a.slug)) {
        const key = `${a.id}-${b.id}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        groups.push({
          reason: `Similar slugs: "${a.slug}" / "${b.slug}"`,
          games: [a, b],
        });
      }
    }
  }

  return groups;
}
