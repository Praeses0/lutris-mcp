# lutris-mcp

MCP server for managing your [Lutris](https://lutris.net) game library. Gives AI assistants direct access to browse, search, and manage your Linux gaming collection.

## Tools

| Tool | Description |
|------|-------------|
| `list_games` | List and filter games with pagination and sorting |
| `get_game` | Get full game details including categories and YAML config |
| `add_game` | Add a new game to the library |
| `update_game` | Update fields on an existing game |
| `remove_game` | Remove a game from the database |
| `list_categories` | List all categories with game counts |
| `create_category` | Create a new category |
| `assign_category` | Add a game to a category (auto-creates if needed) |
| `unassign_category` | Remove a game from a category |
| `search_service_games` | Search games synced from Steam, GOG, etc. |
| `get_library_stats` | Aggregate stats: totals, playtime, breakdowns by runner/platform/service |

## Setup

```json
{
  "mcpServers": {
    "lutris": {
      "command": "node",
      "args": ["/path/to/lutris-mcp/dist/index.js"]
    }
  }
}
```

## Build

```bash
npm install
npm run build
```

## Test

```bash
npm test
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LUTRIS_DB_PATH` | `~/.local/share/lutris/pga.db` | Path to Lutris SQLite database |
| `LUTRIS_GAMES_CONFIG_DIR` | `~/.config/lutris/games` | Path to game YAML configs |

## License

MIT
