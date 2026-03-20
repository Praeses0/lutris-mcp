import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import path from "path";
import yaml from "js-yaml";

function getConfigDir(): string {
  return (
    process.env.LUTRIS_GAMES_CONFIG_DIR ||
    path.join(homedir(), ".config", "lutris", "games")
  );
}

export function readGameConfig(
  configpath: string | null
): Record<string, unknown> | null {
  if (!configpath) return null;

  const configDir = getConfigDir();
  const filePath = path.join(configDir, `${configpath}.yml`);

  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf-8");
    return yaml.load(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}
