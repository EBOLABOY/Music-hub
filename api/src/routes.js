import express from 'express';
import {
  searchTracks,
  resolveTrackUrl,
  resolveTrackCoverUrl,
  resolveTrackLyrics
} from './musicSource.js';

const createRouter = ({ taskStore, downloadManager, libraryService, config }) => {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  router.get('/search', async (req, res, next) => {
    try {
      const rawQuery = (req.query.q || '').toString();
      const rawSource = (req.query.source || 'qobuz').toString();
      const trimmed = rawQuery.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Missing query parameter `q`' });
      }
      const results = await searchTracks(rawQuery, rawSource);
      res.json({ query: trimmed, rawQuery, source: rawSource, results });
    } catch (error) {
      next(error);
    }
  });

  router.get('/downloads', (req, res) => {
    const tasks = taskStore.listTasks();
    res.json({ tasks });
  });

  router.get('/downloads/:id', (req, res) => {
    const task = taskStore.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  });

  router.post('/downloads', async (req, res, next) => {
    try {
      const { trackId, picId, source, title, artist, album } = req.body || {};
      if (!trackId || !source) {
        return res.status(400).json({ error: 'trackId and source are required' });
      }
      const safeTitle = title || `track-${trackId}`;
      const allArtists = artist || 'Unknown Artist';
      const primaryArtist = allArtists.split(',')[0].trim() || 'Unknown Artist';
      const safeAlbum = album || 'Unknown Album';
      const task = taskStore.createTask({
        trackId,
        picId: picId || trackId,
        title: safeTitle,
        artist: primaryArtist,
        album: safeAlbum,
        source
      });

      const [audioInfo, coverInfo, lyricInfo] = await Promise.allSettled([
        resolveTrackUrl(trackId, source),
        resolveTrackCoverUrl(picId || trackId, source),
        resolveTrackLyrics(trackId, source, safeTitle, allArtists, safeAlbum)
      ]);

      const audioResult =
        audioInfo.status === 'fulfilled' ? audioInfo.value?.url || audioInfo.value?.data?.url : null;
      if (!audioResult) {
        taskStore.removeTask(task.id);
        const errorMsg = audioInfo.status === 'rejected'
          ? audioInfo.reason?.message || 'Failed to locate download url for the track'
          : 'Failed to locate download url for the track';
        return res.status(500).json({ error: errorMsg });
      }

      const coverResult =
        coverInfo.status === 'fulfilled' ? coverInfo.value?.url || coverInfo.value?.data?.url : null;
      const lyricResult = lyricInfo.status === 'fulfilled' ? lyricInfo.value : null;

      const urls = {
        audioUrl: audioResult,
        coverUrl: coverResult,
        lyricsContent: lyricResult
      };

      taskStore.attachDownloadUrl(task.id, audioResult);
      downloadManager.enqueue(task.id, urls, {
        artist: primaryArtist,
        title: safeTitle,
        album: safeAlbum
      });
      res.status(201).json(taskStore.getTask(task.id));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/downloads/:id', (req, res) => {
    const removed = taskStore.removeTask(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ removed: removed.id });
  });

  router.post('/library/scan', (req, res) => {
    if (!libraryService?.downloadDir) {
      return res.status(501).json({ error: 'DOWNLOAD_DIR is not configured on the server.' });
    }
    if (libraryService.isScanning) {
      return res.status(409).json({ message: 'A scan is already in progress.' });
    }
    res.status(202).json({ message: 'Library scan started.' });
    libraryService.runScan().catch((err) => {
      console.error('Unhandled library scanner error:', err);
    });
  });

  router.get('/library/status', (req, res) => {
    if (!libraryService) {
      return res.json({ isScanning: false, logs: [] });
    }
    res.json(libraryService.getStatus());
  });

  return router;
};

export default createRouter;
