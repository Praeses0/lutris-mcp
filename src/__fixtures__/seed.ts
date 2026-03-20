import Database from "better-sqlite3";

let db: Database.Database;

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    sortname TEXT,
    slug TEXT UNIQUE,
    installer_slug TEXT,
    parent_slug TEXT,
    platform TEXT,
    runner TEXT,
    executable TEXT,
    directory TEXT,
    updated TEXT,
    lastplayed INTEGER,
    installed INTEGER,
    installed_at INTEGER,
    year INTEGER,
    configpath TEXT,
    has_custom_banner INTEGER,
    has_custom_icon INTEGER,
    has_custom_coverart_big INTEGER,
    playtime REAL,
    service TEXT,
    service_id TEXT,
    discord_id TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS games_categories (
    game_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (game_id, category_id),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS service_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT,
    appid TEXT,
    name TEXT,
    slug TEXT,
    icon TEXT,
    logo TEXT,
    url TEXT,
    details TEXT,
    lutris_slug TEXT
  );
`;

export const SEED_GAMES = [
  { name: "Half-Life 2", slug: "half-life-2", runner: "steam", platform: "linux", installed: 1, playtime: 120.5, service: "steam", service_id: "220", lastplayed: 1700000000, configpath: "half-life-2", directory: "/games/half-life-2", executable: null },
  { name: "The Witcher 3", slug: "the-witcher-3", runner: "wine", platform: "windows", installed: 1, playtime: 250.0, service: "gog", service_id: "gog-123", lastplayed: 1710000000, configpath: "the-witcher-3", directory: "/games/witcher3", executable: "/games/witcher3/bin/witcher3.exe" },
  { name: "Celeste", slug: "celeste", runner: "linux", platform: "linux", installed: 0, playtime: 45.0, service: null, service_id: null, lastplayed: 1690000000, configpath: null, directory: null, executable: null },
  { name: "Portal 2", slug: "portal-2", runner: "steam", platform: "linux", installed: 1, playtime: 30.0, service: "steam", service_id: "620", lastplayed: 1680000000, configpath: "portal-2", directory: "/games/portal-2", executable: null },
  { name: "Untitled Game", slug: "untitled-game", runner: "linux", platform: "linux", installed: 0, playtime: null, service: null, service_id: null, lastplayed: null, configpath: null, directory: null, executable: null },
  { name: "Mystery Game", slug: "mystery-game", runner: null, platform: null, installed: null, playtime: null, service: null, service_id: null, lastplayed: null, configpath: null, directory: null, executable: null },
  // Duplicate: same directory as Half-Life 2
  { name: "Half-Life 2 + Trainer", slug: "half-life-2-trainer", runner: "steam", platform: "linux", installed: 1, playtime: null, service: null, service_id: null, lastplayed: null, configpath: null, directory: "/games/half-life-2", executable: null },
  // For smart search: "Final Fantasy VII" should match "ff7"
  { name: "Final Fantasy VII", slug: "final-fantasy-vii", runner: "wine", platform: "windows", installed: 1, playtime: 60.0, service: null, service_id: null, lastplayed: null, configpath: null, directory: "/games/ff7", executable: null },
];

export const SEED_CATEGORIES = [
  { name: "Favorites" },
  { name: "FPS" },
  { name: "Indie" },
];

// game_id -> category names
export const SEED_GAME_CATEGORIES = [
  { game_id: 1, category: "Favorites" },
  { game_id: 1, category: "FPS" },
  { game_id: 4, category: "FPS" },
  { game_id: 3, category: "Indie" },
];

export const SEED_SERVICE_GAMES = [
  { service: "steam", appid: "220", name: "Half-Life 2", slug: "half-life-2" },
  { service: "steam", appid: "620", name: "Portal 2", slug: "portal-2" },
  { service: "steam", appid: "400", name: "Portal", slug: "portal" },
  { service: "gog", appid: "gog-123", name: "The Witcher 3", slug: "the-witcher-3" },
];

export function setupTestDb(): Database.Database {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function seedData(): void {
  const insertGame = db.prepare(
    `INSERT INTO games (name, slug, runner, platform, installed, playtime, service, service_id, lastplayed, configpath, directory, executable)
     VALUES (:name, :slug, :runner, :platform, :installed, :playtime, :service, :service_id, :lastplayed, :configpath, :directory, :executable)`
  );
  for (const g of SEED_GAMES) {
    insertGame.run(g);
  }

  const insertCat = db.prepare("INSERT INTO categories (name) VALUES (?)");
  for (const c of SEED_CATEGORIES) {
    insertCat.run(c.name);
  }

  const insertGC = db.prepare(
    "INSERT INTO games_categories (game_id, category_id) VALUES (?, (SELECT id FROM categories WHERE name = ?))"
  );
  for (const gc of SEED_GAME_CATEGORIES) {
    insertGC.run(gc.game_id, gc.category);
  }

  const insertSG = db.prepare(
    "INSERT INTO service_games (service, appid, name, slug) VALUES (:service, :appid, :name, :slug)"
  );
  for (const sg of SEED_SERVICE_GAMES) {
    insertSG.run(sg);
  }
}

export function teardownTestDb(): void {
  if (db) {
    db.close();
  }
}

export function getTestDb(): Database.Database {
  return db;
}
