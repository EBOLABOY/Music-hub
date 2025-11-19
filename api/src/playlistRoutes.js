import express from 'express';
import db from './db.js';

const router = express.Router();

// List all playlists
router.get('/', (req, res) => {
    try {
        const playlists = db.getPlaylists();
        res.json(playlists);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new playlist
router.post('/', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const playlist = db.createPlaylist(name);
        res.status(201).json(playlist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get playlist details (with tracks)
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const playlist = db.getPlaylist(id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        const tracks = db.getPlaylistTracks(id);
        res.json({ ...playlist, tracks });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a playlist
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const success = db.deletePlaylist(id);
        if (!success) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a track to a playlist
router.post('/:id/tracks', (req, res) => {
    try {
        const { id } = req.params;
        const { trackId } = req.body;
        if (!trackId) {
            return res.status(400).json({ error: 'trackId is required' });
        }

        // Verify playlist exists
        const playlist = db.getPlaylist(id);
        if (!playlist) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Verify track exists
        const track = db.getTrackById(trackId);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }

        const added = db.addTrackToPlaylist(id, trackId);
        if (!added) {
            return res.status(409).json({ error: 'Track already in playlist' });
        }
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove a track from a playlist
router.delete('/:id/tracks/:trackId', (req, res) => {
    try {
        const { id, trackId } = req.params;
        const success = db.removeTrackFromPlaylist(id, trackId);
        if (!success) {
            return res.status(404).json({ error: 'Track not found in playlist' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
