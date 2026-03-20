export interface Game {
  id: number;
  name: string | null;
  sortname: string | null;
  slug: string | null;
  installer_slug: string | null;
  parent_slug: string | null;
  platform: string | null;
  runner: string | null;
  executable: string | null;
  directory: string | null;
  updated: string | null;
  lastplayed: number | null;
  installed: number | null;
  installed_at: number | null;
  year: number | null;
  configpath: string | null;
  has_custom_banner: number | null;
  has_custom_icon: number | null;
  has_custom_coverart_big: number | null;
  playtime: number | null;
  service: string | null;
  service_id: string | null;
  discord_id: string | null;
}

export interface ServiceGame {
  id: number;
  service: string | null;
  appid: string | null;
  name: string | null;
  slug: string | null;
  icon: string | null;
  logo: string | null;
  url: string | null;
  details: string | null;
  lutris_slug: string | null;
}

export interface Category {
  id: number;
  name: string;
}

export interface GameCategory {
  game_id: number;
  category_id: number;
}

export interface CategoryWithCount extends Category {
  game_count: number;
}
