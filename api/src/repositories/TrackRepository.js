import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository.js';

export class TrackRepository extends BaseRepository {
    constructor(db, albumRepository) {
        super(db);
        this.albumRepository = albumRepository;
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

        const album = this.albumRepository.getOrCreateAlbum(
            albumName || 'Unknown Album',
            artist || 'Unknown Artist',
            coverPath,
            year
        );

        const findTrack = this.db.prepare('SELECT id FROM tracks WHERE file_path = ?');
        const existing = findTrack.get(filePath);
        const trackId = existing ? existing.id : uuidv4();
        const now = new Date().toISOString();

        const stmt = this.db.prepare(`
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

    getAlbumTracks(albumId) {
        return this.db
            .prepare('SELECT * FROM tracks WHERE album_id = ? ORDER BY disc_number ASC, track_number ASC, title ASC')
            .all(albumId);
    }

    getAllTracks(limit = 500) {
        return this.db.prepare('SELECT * FROM tracks ORDER BY created_at DESC LIMIT ?').all(limit);
    }

    getTrackById(id) {
        return this.db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
    }

    getTrackBySourceTrack(sourceTrackId, source) {
        if (!sourceTrackId || !source) return null;
        return this.db
            .prepare(
                `SELECT tracks.*, albums.name AS album_name
         FROM tracks
         LEFT JOIN albums ON tracks.album_id = albums.id
         WHERE tracks.source_track_id = ? AND tracks.source = ?
         LIMIT 1`
            )
            .get(sourceTrackId, source);
    }
}
