import { homedir } from "os";
import path from "path";

export function getConfigDir(): string {
  return (
    process.env.LUTRIS_GAMES_CONFIG_DIR ||
    path.join(homedir(), ".config", "lutris", "games")
  );
}
