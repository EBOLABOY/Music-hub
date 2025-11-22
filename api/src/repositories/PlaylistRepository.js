import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository.js';

export class PlaylistRepository extends BaseRepository {
    constructor(db, trackRepository) {
        super(db);
        this.trackRepository = trackRepository;
    }

    getPlaylists() {
        return this.db.prepare('SELECT * FROM playlists ORDER BY created_at DESC').all();
    }

    createPlaylist(name) {
        const id = uuidv4();
        const now = new Date().toISOString();
        this.db.prepare('INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)').run(id, name, now);
        return { id, name, created_at: now };
    }

    getPlaylist(id) {
        return this.db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
    }

    getPlaylistTracks(playlistId) {
        return this.db
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
        const result = this.db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
        return result.changes > 0;
    }

    addTrackToPlaylist(playlistId, trackId) {
        const now = new Date().toISOString();
        const result = this.db
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
        const playlist = this.db.prepare('SELECT cover_track_id FROM playlists WHERE id = ?').get(playlistId);
        const result = this.db
            .prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
            .run(playlistId, trackId);
        const removed = result.changes > 0;
        if (removed && playlist?.cover_track_id === trackId) {
            this.refreshPlaylistCover(playlistId);
        }
        return removed;
    }

    ensurePlaylistCover(playlistId, trackId) {
        const playlist = this.db.prepare('SELECT cover_track_id FROM playlists WHERE id = ?').get(playlistId);
        if (!playlist || playlist.cover_track_id) {
            return;
        }
        this.setPlaylistCoverFromTrack(playlistId, trackId);
    }

    refreshPlaylistCover(playlistId) {
        const nextTrack = this.db
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
            this.db.prepare('UPDATE playlists SET cover_track_id = NULL, cover_album_id = NULL WHERE id = ?').run(
                playlistId
            );
        }
    }

    setPlaylistCoverFromTrack(playlistId, trackId) {
        const track = this.trackRepository.getTrackById(trackId);
        if (!track) {
            return;
        }
        this.db.prepare('UPDATE playlists SET cover_track_id = ?, cover_album_id = ? WHERE id = ?').run(
            track.id,
            track.album_id || null,
            playlistId
        );
    }
}
