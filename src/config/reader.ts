import { readFileSync, existsSync } from "fs";
import path from "path";
import yaml from "js-yaml";
import { getConfigDir } from "./paths.js";

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
