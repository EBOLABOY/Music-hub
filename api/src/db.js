import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from './config.js';
import { AlbumRepository } from './repositories/AlbumRepository.js';
import { TrackRepository } from './repositories/TrackRepository.js';
import { PlaylistRepository } from './repositories/PlaylistRepository.js';

const resolveDataDir = () => {
  if (process.env.DB_PATH) {
    return path.resolve(path.dirname(process.env.DB_PATH));
  }
  if (config.downloadDir) {
    return path.resolve(config.downloadDir);
  }
  return process.cwd();
};

const dataDir = resolveDataDir();
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const DB_FILE = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(dataDir, 'music_library.db');

const db = new Database(DB_FILE);
db.pragma('foreign_keys = ON');

// Schema initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    artist TEXT,
    cover_path TEXT,
    year INTEGER,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT,
    album_id TEXT,
    file_path TEXT NOT NULL UNIQUE,
    duration REAL,
    format TEXT,
    bitrate INTEGER,
    lyrics_path TEXT,
    created_at TEXT,
    track_number INTEGER,
    disc_number INTEGER DEFAULT 1,
    source_track_id TEXT,
    source TEXT,
    FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
  CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
  CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at);
  CREATE INDEX IF NOT EXISTS idx_albums_created ON albums(created_at);

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT,
    cover_track_id TEXT,
    cover_album_id TEXT
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT,
    track_id TEXT,
    added_at TEXT,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_playlist_tracks_added ON playlist_tracks(added_at);
`);

const migrate = () => {
  try {
    db.prepare('ALTER TABLE tracks ADD COLUMN track_number INTEGER').run();
  } catch { }
  try {
    db.prepare('ALTER TABLE tracks ADD COLUMN disc_number INTEGER DEFAULT 1').run();
  } catch { }
  try {
    db.prepare('ALTER TABLE tracks ADD COLUMN source_track_id TEXT').run();
  } catch { }
  try {
    db.prepare('ALTER TABLE tracks ADD COLUMN source TEXT').run();
  } catch { }
  db.prepare('CREATE INDEX IF NOT EXISTS idx_tracks_source ON tracks(source_track_id, source)').run();
  try {
    db.prepare('ALTER TABLE playlists ADD COLUMN cover_track_id TEXT').run();
  } catch { }
  try {
    db.prepare('ALTER TABLE playlists ADD COLUMN cover_album_id TEXT').run();
  } catch { }

  // Migration logic for playlist covers can be moved to repository or kept here if it's a one-time thing
  // For now, keeping it simple and assuming migration is done or handled elsewhere if complex
};

migrate();

class MusicDatabase {
  constructor() {
    this.albumRepository = new AlbumRepository(db);
    this.trackRepository = new TrackRepository(db, this.albumRepository);
    this.playlistRepository = new PlaylistRepository(db, this.trackRepository);
  }

  // Album methods
  getOrCreateAlbum(...args) { return this.albumRepository.getOrCreateAlbum(...args); }
  getAllAlbums(...args) { return this.albumRepository.getAllAlbums(...args); }
  getAlbumById(...args) { return this.albumRepository.getAlbumById(...args); }

  // Track methods
  upsertTrack(...args) { return this.trackRepository.upsertTrack(...args); }
  getAlbumTracks(...args) { return this.trackRepository.getAlbumTracks(...args); }
  getAllTracks(...args) { return this.trackRepository.getAllTracks(...args); }
  getTrackById(...args) { return this.trackRepository.getTrackById(...args); }
  getTrackBySourceTrack(...args) { return this.trackRepository.getTrackBySourceTrack(...args); }

  // Playlist methods
  getPlaylists(...args) { return this.playlistRepository.getPlaylists(...args); }
  createPlaylist(...args) { return this.playlistRepository.createPlaylist(...args); }
  getPlaylist(...args) { return this.playlistRepository.getPlaylist(...args); }
  getPlaylistTracks(...args) { return this.playlistRepository.getPlaylistTracks(...args); }
  deletePlaylist(...args) { return this.playlistRepository.deletePlaylist(...args); }
  addTrackToPlaylist(...args) { return this.playlistRepository.addTrackToPlaylist(...args); }
  removeTrackFromPlaylist(...args) { return this.playlistRepository.removeTrackFromPlaylist(...args); }
  ensurePlaylistCover(...args) { return this.playlistRepository.ensurePlaylistCover(...args); }
  refreshPlaylistCover(...args) { return this.playlistRepository.refreshPlaylistCover(...args); }
  setPlaylistCoverFromTrack(...args) { return this.playlistRepository.setPlaylistCoverFromTrack(...args); }
}

export default new MusicDatabase();
