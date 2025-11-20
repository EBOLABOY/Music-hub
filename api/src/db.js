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
  try {
    db.prepare('ALTER TABLE tracks ADD COLUMN source_track_id TEXT').run();
    console.log('Migrated: Added source_track_id column');
  } catch {
    // column already exists
  }
  try {
    db.prepare('ALTER TABLE tracks ADD COLUMN source TEXT').run();
    console.log('Migrated: Added source column');
  } catch {
    // column already exists
  }
  db.prepare('CREATE INDEX IF NOT EXISTS idx_tracks_source ON tracks(source_track_id, source)').run();
  try {
    db.prepare('ALTER TABLE playlists ADD COLUMN cover_track_id TEXT').run();
    console.log('Migrated: Added playlists.cover_track_id column');
  } catch {
    // already exists
  }
  try {
    db.prepare('ALTER TABLE playlists ADD COLUMN cover_album_id TEXT').run();
    console.log('Migrated: Added playlists.cover_album_id column');
  } catch {
    // already exists
  }
  db.prepare(
    `UPDATE playlists
     SET cover_track_id = (
       SELECT track_id
       FROM playlist_tracks
       WHERE playlist_tracks.playlist_id = playlists.id
       ORDER BY datetime(playlist_tracks.added_at) DESC
       LIMIT 1
     ),
     cover_album_id = (
       SELECT t.album_id
       FROM playlist_tracks pt
       JOIN tracks t ON pt.track_id = t.id
       WHERE pt.playlist_id = playlists.id
       ORDER BY datetime(pt.added_at) DESC
       LIMIT 1
     )
     WHERE cover_track_id IS NULL`
  ).run();
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
      discNumber,
      source,
      sourceTrackId
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
        source_track_id,
        source,
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
        @sourceTrackId,
        @source,
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
        disc_number=excluded.disc_number,
        source_track_id=COALESCE(excluded.source_track_id, tracks.source_track_id),
        source=COALESCE(excluded.source, tracks.source)
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
      sourceTrackId: sourceTrackId ?? null,
      source: source ?? null,
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

  getTrackBySourceTrack(sourceTrackId, source) {
    if (!sourceTrackId || !source) return null;
    return db
      .prepare(
        `SELECT tracks.*, albums.name AS album_name
         FROM tracks
         LEFT JOIN albums ON tracks.album_id = albums.id
         WHERE tracks.source_track_id = ? AND tracks.source = ?
         LIMIT 1`
      )
      .get(sourceTrackId, source);
  }

  getPlaylists() {
    return db.prepare('SELECT * FROM playlists ORDER BY created_at DESC').all();
  }

  createPlaylist(name) {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)').run(id, name, now);
    return { id, name, created_at: now };
  }

  getPlaylist(id) {
    return db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  }

  getPlaylistTracks(playlistId) {
    return db
      .prepare(
        `SELECT t.*, pt.added_at
         FROM playlist_tracks pt
         JOIN tracks t ON pt.track_id = t.id
         WHERE pt.playlist_id = ?
         ORDER BY datetime(pt.added_at) DESC`
      )
      .all(playlistId);
  }

  deletePlaylist(id) {
    const result = db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
    return result.changes > 0;
  }

  addTrackToPlaylist(playlistId, trackId) {
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, added_at)
         VALUES (?, ?, ?)`
      )
      .run(playlistId, trackId, now);
    const inserted = result.changes > 0;
    if (inserted) {
      this.ensurePlaylistCover(playlistId, trackId);
    }
    return inserted;
  }

  removeTrackFromPlaylist(playlistId, trackId) {
    const playlist = db.prepare('SELECT cover_track_id FROM playlists WHERE id = ?').get(playlistId);
    const result = db
      .prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
      .run(playlistId, trackId);
    const removed = result.changes > 0;
    if (removed && playlist?.cover_track_id === trackId) {
      this.refreshPlaylistCover(playlistId);
    }
    return removed;
  }

  ensurePlaylistCover(playlistId, trackId) {
    const playlist = db.prepare('SELECT cover_track_id FROM playlists WHERE id = ?').get(playlistId);
    if (!playlist || playlist.cover_track_id) {
      return;
    }
    this.setPlaylistCoverFromTrack(playlistId, trackId);
  }

  refreshPlaylistCover(playlistId) {
    const nextTrack = db
      .prepare(
        `SELECT t.id
         FROM playlist_tracks pt
         JOIN tracks t ON pt.track_id = t.id
         WHERE pt.playlist_id = ?
         ORDER BY datetime(pt.added_at) DESC
         LIMIT 1`
      )
      .get(playlistId);
    if (nextTrack) {
      this.setPlaylistCoverFromTrack(playlistId, nextTrack.id);
    } else {
      db.prepare('UPDATE playlists SET cover_track_id = NULL, cover_album_id = NULL WHERE id = ?').run(
        playlistId
      );
    }
  }

  setPlaylistCoverFromTrack(playlistId, trackId) {
    const track = this.getTrackById(trackId);
    if (!track) {
      return;
    }
    db.prepare('UPDATE playlists SET cover_track_id = ?, cover_album_id = ? WHERE id = ?').run(
      track.id,
      track.album_id || null,
      playlistId
    );
  }
}

export default new MusicDatabase();
