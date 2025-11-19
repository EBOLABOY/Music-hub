import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import config from './config.js';

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
    FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
  CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
  CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at);
  CREATE INDEX IF NOT EXISTS idx_albums_created ON albums(created_at);

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT
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
    console.log('Migrated: Added track_number column');
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE tracks ADD COLUMN disc_number INTEGER DEFAULT 1').run();
    console.log('Migrated: Added disc_number column');
  } catch {
    // column already exists
  }
};

migrate();

class MusicDatabase {
  getOrCreateAlbum(name, artist, coverPath, year) {
    const albumName = name || 'Unknown Album';
    const albumArtist = artist || 'Unknown Artist';
    const findStmt = db.prepare('SELECT * FROM albums WHERE name = ? AND artist = ?');
    const existing = findStmt.get(albumName, albumArtist);

    if (existing) {
      if (coverPath && !existing.cover_path) {
        try {
          db.prepare('UPDATE albums SET cover_path = ? WHERE id = ?').run(coverPath, existing.id);
        } catch {
          // ignore sqlite write race
        }
      }
      return existing;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    try {
      db.prepare(
        `INSERT INTO albums (id, name, artist, cover_path, year, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, albumName, albumArtist, coverPath || null, year || null, now);
      return {
        id,
        name: albumName,
        artist: albumArtist,
        cover_path: coverPath || null,
        year: year || null
      };
    } catch {
      return findStmt.get(albumName, albumArtist);
    }
  }

  upsertTrack(metadata, filePath, lyricsPath) {
    if (!filePath) {
      throw new Error('filePath is required for upsertTrack');
    }
    const {
      title,
      artist,
      album: albumName,
      duration,
      bitrate,
      format,
      year,
      trackNumber,
      discNumber
    } = metadata || {};
    const dir = path.dirname(filePath);
    let coverPath = path.join(dir, 'folder.jpg');
    if (!fs.existsSync(coverPath)) {
      coverPath = null;
    }

    const album = this.getOrCreateAlbum(
      albumName || 'Unknown Album',
      artist || 'Unknown Artist',
      coverPath,
      year
    );

    const findTrack = db.prepare('SELECT id FROM tracks WHERE file_path = ?');
    const existing = findTrack.get(filePath);
    const trackId = existing ? existing.id : uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO tracks (
        id,
        title,
        artist,
        album_id,
        file_path,
        duration,
        format,
        bitrate,
        lyrics_path,
        track_number,
        disc_number,
        created_at
      )
      VALUES (
        @id,
        @title,
        @artist,
        @albumId,
        @filePath,
        @duration,
        @format,
        @bitrate,
        @lyricsPath,
        @trackNumber,
        @discNumber,
        @createdAt
      )
      ON CONFLICT(file_path) DO UPDATE SET
        title=excluded.title,
        artist=excluded.artist,
        album_id=excluded.album_id,
        lyrics_path=excluded.lyrics_path,
        duration=excluded.duration,
        bitrate=excluded.bitrate,
        format=excluded.format,
        track_number=excluded.track_number,
        disc_number=excluded.disc_number
    `);

    stmt.run({
      id: trackId,
      title: title || path.basename(filePath),
      artist: artist || 'Unknown Artist',
      albumId: album.id,
      filePath,
      duration: duration || 0,
      format: format || path.extname(filePath).replace('.', '') || 'mp3',
      bitrate: bitrate || 0,
      lyricsPath: lyricsPath || null,
      trackNumber: trackNumber ?? null,
      discNumber: discNumber ?? 1,
      createdAt: now
    });

    return trackId;
  }

  getAllAlbums() {
    return db.prepare('SELECT * FROM albums ORDER BY created_at DESC').all();
  }

  getAlbumById(id) {
    return db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
  }

  getAlbumTracks(albumId) {
    return db
      .prepare('SELECT * FROM tracks WHERE album_id = ? ORDER BY disc_number ASC, track_number ASC, title ASC')
      .all(albumId);
  }

  getAllTracks(limit = 500) {
    return db.prepare('SELECT * FROM tracks ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  getTrackById(id) {
    return db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
  }
}

export default new MusicDatabase();
