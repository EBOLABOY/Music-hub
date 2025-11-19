import express from 'express';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import db from './db.js';

const router = express.Router();

router.get('/albums', (req, res) => {
  try {
    res.json(db.getAllAlbums());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/albums/:id', (req, res) => {
  try {
    const album = db.getAlbumById(req.params.id);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }
    const tracks = db.getAlbumTracks(req.params.id);
    return res.json({ ...album, tracks });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/tracks', (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10);
  const result = Number.isFinite(limit) && limit > 0 ? limit : 500;
  try {
    res.json(db.getAllTracks(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stream/:id', (req, res) => {
  try {
    const track = db.getTrackById(req.params.id);
    if (!track || !track.file_path || !fs.existsSync(track.file_path)) {
      return res.status(404).send('File not found');
    }
    const filePath = track.file_path;
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = mime.lookup(filePath) || 'audio/mpeg';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = Number.parseInt(parts[0], 10);
      const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize) {
        return res.status(416).send('Requested Range Not Satisfiable');
      }
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).send('Stream error');
    }
  }
});

router.get('/cover/:type/:id', (req, res) => {
  try {
    const { type, id } = req.params;
    let coverPath = null;
    if (type === 'album') {
      coverPath = db.getAlbumById(id)?.cover_path || null;
    } else if (type === 'track') {
      const track = db.getTrackById(id);
      if (track?.file_path) {
        coverPath = path.join(path.dirname(track.file_path), 'folder.jpg');
      }
    }
    if (coverPath && fs.existsSync(coverPath)) {
      return res.sendFile(path.resolve(coverPath));
    }
    return res.status(404).send('No cover');
  } catch (error) {
    return res.status(404).send('Error fetching cover');
  }
});

router.get('/lyrics/:id', (req, res) => {
  try {
    const track = db.getTrackById(req.params.id);
    if (track?.lyrics_path && fs.existsSync(track.lyrics_path)) {
      return res.sendFile(path.resolve(track.lyrics_path));
    }
    return res.status(404).send('');
  } catch {
    return res.status(404).send('');
  }
});

export default router;
