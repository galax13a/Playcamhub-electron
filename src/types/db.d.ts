// Row shapes for SQLite tables. SQLite stores booleans as 0/1 and dates as
// TEXT, so those are typed as `number` / `string` accordingly. Use these with
// better-sqlite3 generics, e.g. `db.prepare(sql).get(id) as UserRow`.

export {};

export interface UserRow {
  id: number;
  username: string;
  password: string;
  created_at: string;
  full_name: string;
  nickname: string;
  whatsapp: string | null;
  avatar: string | null;
  name: string;
  email: string | null;
  google_id: string | null;
  email_verified_at: string | null;
  whatsapp_verified_at: string | null;
  two_factor_secret: string | null;
  two_factor_recovery_codes: string | null;
  two_factor_confirmed_at: string | null;
  remember_token: string | null;
  locale: string;
  subscription_level: string;
  is_banned: number;
  banned_until: string | null;
  ban_reason: string | null;
  updated_at: string | null;
}

export interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface PluginRow {
  id: string;
  name: string;
  version: string;
  enabled: number;
  installed_at: string;
}

export interface AppSessionRow {
  token: string;
  username: string;
  expires_at: number;
  created_at: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  color: string;
  icon: string;
}

export interface SongRow {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  file_path: string;
  thumbnail: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  category_id: number | null;
  type: 'audio' | 'video';
  is_favorite: number;
  play_count: number;
  added_at: string;
}

/** A song joined with its category (as returned by Song.findAll/findById). */
export interface SongWithCategory extends SongRow {
  category_name: string | null;
  category_color: string | null;
  category_icon?: string | null;
}

export interface AlbumRow {
  id: number;
  name: string;
  description: string;
  cover_id: number | null;
  created_at: string;
  updated_at: string;
  tag: string;
  color: string;
  importance: number;
  objective: string;
  price: number;
  currency: string;
  payment_method: string;
  view_count: number;
  is_favorite: number;
}

export interface MediaRow {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  media_type: 'photo' | 'video';
  width: number | null;
  height: number | null;
  duration: number | null;
  original_format: string | null;
  compressed_format: string;
  thumbnail_path: string | null;
  album_id: number | null;
  is_favorite: number;
  view_count: number;
  tags: string;
  metadata: string;
  created_at: string;
  updated_at: string;
  editor_state: string | null;
  title: string;
  description: string;
  likes: number;
  rating: number;
  rating_count: number;
}

export interface CommentRow {
  id: number;
  entity_type: 'media' | 'album';
  entity_id: number;
  text: string;
  author: string;
  created_at: string;
}

export interface ContactRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string | null;
  username: string | null;
  avatar: string | null;
  active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Aggregate helper rows. */
export interface CountRow {
  n: number;
}
