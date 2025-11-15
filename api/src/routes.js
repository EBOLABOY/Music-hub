import express from 'express';
import { searchTracks, resolveTrackUrl } from './musicSource.js';

const createRouter = ({ taskStore, downloadManager, config }) => {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  router.get('/search', async (req, res, next) => {
    try {
      const rawQuery = (req.query.q || '').toString();
      const trimmed = rawQuery.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Missing query parameter `q`' });
      }
      const results = await searchTracks(rawQuery);
      res.json({ query: trimmed, rawQuery, results });
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
      const { trackId, title, artist } = req.body || {};
      if (!trackId) {
        return res.status(400).json({ error: 'trackId is required' });
      }
      const safeTitle = title || `track-${trackId}`;
      const task = taskStore.createTask({
        trackId,
        title: safeTitle,
        artist: artist || 'Unknown Artist',
        source: config.musicSource.source
      });

      const trackInfo = await resolveTrackUrl(trackId);
      const downloadUrl = trackInfo?.url || trackInfo?.data?.url;
      if (!downloadUrl) {
        taskStore.removeTask(task.id);
        return res.status(500).json({ error: 'Failed to locate download url for the track' });
      }
      taskStore.attachDownloadUrl(task.id, downloadUrl);
      downloadManager.enqueue(task.id, downloadUrl, safeTitle);
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

  return router;
};

export default createRouter;
