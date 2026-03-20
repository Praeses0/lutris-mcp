import { writeFileSync, renameSync } from "fs";
import path from "path";
import yaml from "js-yaml";
import { getConfigDir } from "./paths.js";

export function writeGameConfig(
  configpath: string,
  config: Record<string, unknown>
): void {
  const configDir = getConfigDir();
  const filePath = path.join(configDir, `${configpath}.yml`);
  const tmpPath = filePath + ".tmp";
  const content = yaml.dump(config, { lineWidth: -1 });
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, filePath);
}
