import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository.js';

export class AlbumRepository extends BaseRepository {
    getOrCreateAlbum(name, artist, coverPath, year) {
        const albumName = name || 'Unknown Album';
        const albumArtist = artist || 'Unknown Artist';
        const findStmt = this.db.prepare('SELECT * FROM albums WHERE name = ? AND artist = ?');
        const existing = findStmt.get(albumName, albumArtist);

        if (existing) {
            if (coverPath && !existing.cover_path) {
                try {
                    this.db.prepare('UPDATE albums SET cover_path = ? WHERE id = ?').run(coverPath, existing.id);
                } catch {
                    // ignore sqlite write race
                }
            }
            return existing;
        }

        const id = uuidv4();
        const now = new Date().toISOString();
        try {
            this.db.prepare(
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

    getAllAlbums() {
        return this.db.prepare('SELECT * FROM albums ORDER BY created_at DESC').all();
    }

    getAlbumById(id) {
        return this.db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
    }
}
