import express from 'express';
import {
  searchTracks,
  resolveTrackUrl,
  resolveTrackCoverUrl,
  resolveTrackLyrics
} from './musicSource.js';
import { fetchFallbackCover, fetchFallbackLyrics } from './fallbackAssets.js';
import { fetchTrackMetadata } from './trackMetadata.js';

const extractUrl = (payload) => {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;

  if (typeof payload === 'object') {
    if (typeof payload.url === 'string') {
      return payload.url;
    }

    if (payload.data) {
      const data = payload.data;
      if (typeof data === 'string') {
        return data;
      }
      if (Array.isArray(data)) {
        for (const entry of data) {
          const nested = extractUrl(entry);
          if (nested) return nested;
        }
      } else if (typeof data === 'object') {
        const nested = extractUrl(data);
        if (nested) return nested;
      }
    }
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const nested = extractUrl(entry);
      if (nested) return nested;
    }
  }

  return null;
};

const preview = (payload, maxLength = 600) => {
  try {
    const str =
      typeof payload === 'string'
        ? payload
        : JSON.stringify(payload, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
          );
    if (!str) return '';
    return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
  } catch (error) {
    return `[unserializable: ${error.message}]`;
  }
};

const buildAudioErrorPayload = (audioInfo, trackId, source) => {
  if (audioInfo.status === 'rejected') {
    return {
      message: audioInfo.reason?.message || 'Failed to locate download url for the track',
      details: {
        trackId,
        source,
        status: 'rejected'
      }
    };
  }

  const attemptsPreview =
    Array.isArray(audioInfo.value?.attempts) && audioInfo.value.attempts.length > 0
      ? audioInfo.value.attempts.map((a) => ({
          br: a?.br,
          resp: preview(a?.resp, 400)
        }))
      : undefined;

  return {
    message: 'Failed to locate download url for the track',
    details: {
      trackId,
      source,
      status: 'fulfilled',
      responsePreview: preview(audioInfo.value),
      attempts: attemptsPreview
    }
  };
};

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

      const metadataPromise = fetchTrackMetadata({
        trackId,
        source,
        fallback: {
          title: safeTitle,
          artist: allArtists,
          album: safeAlbum,
          albumArtist: primaryArtist
        },
        config
      });

      const [audioInfo, coverInfo, lyricInfo, metadataInfo] = await Promise.allSettled([
        resolveTrackUrl(trackId, source),
        resolveTrackCoverUrl(picId || trackId, source),
        resolveTrackLyrics(trackId, source, safeTitle, allArtists, safeAlbum),
        metadataPromise
      ]);

      const audioResult =
        audioInfo.status === 'fulfilled' ? extractUrl(audioInfo.value) : null;
      if (!audioResult) {
        const errorPayload = buildAudioErrorPayload(audioInfo, trackId, source);
        if (audioInfo.status === 'fulfilled') {
          const attemptsPreview = Array.isArray(audioInfo.value?.attempts)
            ? audioInfo.value.attempts
                .map((a) => `[br=${a.br}] ${preview(a.resp, 200)}`)
                .join('\n')
            : preview(audioInfo.value);
          console.error(
            `Audio URL extraction failed for track ${trackId} (${source}). Responses:\n${attemptsPreview}`
          );
        } else {
          console.error(
            `Audio URL request rejected for track ${trackId} (${source}):`,
            audioInfo.reason?.message || audioInfo.reason
          );
        }
        taskStore.removeTask(task.id);
        return res.status(500).json({
          error: errorPayload.message,
          details: errorPayload.details
        });
      }

      let coverResult =
        coverInfo.status === 'fulfilled' ? extractUrl(coverInfo.value) : null;
      let lyricResult = lyricInfo.status === 'fulfilled' ? lyricInfo.value : null;
      const metadata =
        metadataInfo.status === 'fulfilled'
          ? metadataInfo.value
          : {
              title: safeTitle,
              artist: allArtists,
              album: safeAlbum,
              albumArtist: primaryArtist,
              trackNumber: null,
              discNumber: null,
              releaseYear: null,
              coverUrl: null,
              source,
              trackId
            };

      const finalTitle = metadata.title || safeTitle;
      const finalArtist = metadata.artist || allArtists;
      const finalAlbum = metadata.album || safeAlbum;
      const finalAlbumArtist = metadata.albumArtist || finalArtist;
      const stableSources = Array.isArray(config.musicSource?.stableSources)
        ? config.musicSource.stableSources
        : [];

      const fallbackContext = { title: finalTitle, artist: finalArtist, album: finalAlbum };
      if (!coverResult && stableSources.length > 0) {
        const fallbackCover = await fetchFallbackCover(fallbackContext, stableSources);
        if (fallbackCover?.url) {
          coverResult = fallbackCover.url;
          if (!metadata.coverUrl) {
            metadata.coverUrl = fallbackCover.url;
          }
        }
      }

      if (!lyricResult && stableSources.length > 0) {
        const fallbackLyrics = await fetchFallbackLyrics(fallbackContext, stableSources);
        if (fallbackLyrics?.lyrics) {
          lyricResult = fallbackLyrics.lyrics;
        }
      }

      const finalCoverUrl = coverResult || metadata.coverUrl || null;

      const urls = {
        audioUrl: audioResult,
        coverUrl: finalCoverUrl,
        lyricsContent: lyricResult
      };

      taskStore.attachDownloadUrl(task.id, audioResult);
      downloadManager.enqueue(task.id, urls, {
        artist: finalArtist,
        albumArtist: finalAlbumArtist,
        title: finalTitle,
        album: finalAlbum,
        trackNumber: metadata.trackNumber,
        discNumber: metadata.discNumber,
        releaseYear: metadata.releaseYear,
        source,
        trackId
      });
      taskStore.updateTask(task.id, {
        title: finalTitle,
        artist: finalArtist,
        album: finalAlbum
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
