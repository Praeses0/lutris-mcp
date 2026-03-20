# lutris-mcp

MCP server for managing your [Lutris](https://lutris.net) game library. Gives AI assistants direct access to browse, search, organize, launch, and install games in your Linux gaming collection.

## Examples

Here are some things you can ask your AI assistant once this server is connected:

- "What games do I have installed?"
- "Show me my most played games"
- "Search my Steam library for Hades"
- "Launch Balatro"
- "Install this game from `/path/to/setup.exe`"
- "Add all my roguelike games to a 'Roguelike' category"
- "Are there any duplicate games in my library?"
- "Show me the log for my last Hades II session"
- "Export my installed games as JSON"
- "Set the cover art for Timberborn from this image"

## Installation

### Quick Start (npx)

No install needed — just add to your MCP client config:

```json
{
  "mcpServers": {
    "lutris": {
      "command": "npx",
      "args": ["-y", "lutris-mcp"]
    }
  }
}
```

### Global Install

```bash
npm install -g lutris-mcp
```

Then configure your MCP client:

```json
{
  "mcpServers": {
    "lutris": {
      "command": "lutris-mcp"
    }
  }
}
```

### From Source

```bash
git clone https://github.com/Praeses0/lutris-mcp.git
cd lutris-mcp
npm install
npm run build
```

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

## Requirements

- [Lutris](https://lutris.net) installed and set up
- Node.js 20+

## Tools

### Library

| Tool | Description |
|------|-------------|
| `list_games` | List and filter games with pagination, sorting, and smart search |
| `get_game` | Get full game details including categories, config, and media paths |
| `add_game` | Add a new game to the library |
| `update_game` | Update fields on an existing game |
| `remove_game` | Remove a game from the database (does not delete files) |
| `get_library_stats` | Aggregate stats: totals, playtime, breakdowns by runner/platform/service |
| `find_duplicates` | Find potential duplicate games (same directory or similar slugs) |
| `export_library` | Export full library as JSON with optional filters (category, runner, installed) |

### Categories

| Tool | Description |
|------|-------------|
| `list_categories` | List all categories with game counts |
| `create_category` | Create a new category |
| `assign_category` | Add a game to a category |
| `unassign_category` | Remove a game from a category |
| `bulk_assign_category` | Add multiple games to a category at once |

### Services

| Tool | Description |
|------|-------------|
| `search_service_games` | Search games synced from Steam, GOG, etc. |
| `import_service_game` | Import a service game into your Lutris library |

### Launch & Install

| Tool | Description |
|------|-------------|
| `launch_game` | Launch an installed game via Lutris |
| `install_game` | Install a game from a Lutris installer slug or local setup executable |
| `check_game_running` | Check if a game is currently running (multi-strategy detection) |

### Configuration

| Tool | Description |
|------|-------------|
| `read_game_config` | Read a game's YAML configuration file |
| `write_game_config` | Update or create a game's YAML configuration (deep-merged) |

### Media

| Tool | Description |
|------|-------------|
| `set_game_cover` | Set a game's cover art, banner, or icon from a local file |
| `get_game_media` | Get all media paths for a game with existence check |

### System

| Tool | Description |
|------|-------------|
| `list_runners` | List available Lutris runners or Wine versions |
| `view_game_log` | Read the last launch log for a game (for troubleshooting) |

### Bulk Operations

| Tool | Description |
|------|-------------|
| `bulk_update_games` | Update a field on multiple games at once |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LUTRIS_DB_PATH` | `~/.local/share/lutris/pga.db` | Path to Lutris SQLite database |
| `LUTRIS_GAMES_CONFIG_DIR` | `~/.config/lutris/games` | Path to game YAML configs |
| `LUTRIS_DATA_DIR` | `~/.local/share/lutris` | Path to Lutris data directory (media, logs) |

## Development

```bash
npm install       # install dependencies
npm run build     # compile TypeScript
npm test          # run tests (219 tests)
npm run dev       # run with tsx (hot reload)
```

## License

MIT
