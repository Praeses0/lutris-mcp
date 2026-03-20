import { existsSync } from "fs";
import { homedir } from "os";
import path from "path";

export interface GameMedia {
  coverart: string | null;
  banner: string | null;
  icon: string | null;
}

function getDataDir(): string {
  return (
    process.env.LUTRIS_DATA_DIR ||
    path.join(homedir(), ".local", "share", "lutris")
  );
}

function findMedia(dir: string, slug: string): string | null {
  for (const ext of [".jpg", ".png"]) {
    const filePath = path.join(dir, slug + ext);
    if (existsSync(filePath)) return "file://" + filePath;
  }
  return null;
}

export function getGameMediaPaths(slug: string | null): GameMedia {
  if (!slug) return { coverart: null, banner: null, icon: null };
  const dataDir = getDataDir();
  return {
    coverart: findMedia(path.join(dataDir, "coverart"), slug),
    banner: findMedia(path.join(dataDir, "banners"), slug),
    icon: findMedia(path.join(dataDir, "icons"), slug),
  };
}
