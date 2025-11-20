import express from 'express';
import {
  searchTracks,
  resolveTrackUrl,
  resolveTrackCoverUrl,
  resolveTrackLyrics,
  fetchPlaylistDetail
} from './musicSource.js';
import { fetchFallbackCover, fetchFallbackLyrics } from './fallbackAssets.js';
import { fetchTrackMetadata } from './trackMetadata.js';
import db from './db.js';

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

const toSafeString = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value || null;
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : null;
  if (typeof value === 'bigint') return value.toString();
  return null;
};

const normalizeChartPlaylist = (payload, source) => {
  if (!payload) {
    throw new Error('Empty playlist payload');
  }

  if (payload.code && payload.code !== 200 && !payload.playlist) {
    throw new Error(`Playlist request failed with code ${payload.code}`);
  }

  const playlist =
    payload.playlist ||
    payload.result?.playlist ||
    payload.data?.playlist ||
    payload;

  if (!playlist || !Array.isArray(playlist.tracks)) {
    throw new Error('Playlist tracks missing from payload');
  }

  const privileges = Array.isArray(payload.privileges) ? payload.privileges : [];

  const tracks = playlist.tracks.map((track, index) => {
    const artists = Array.isArray(track?.ar)
      ? track.ar.map((artist) => artist?.name).filter(Boolean)
      : [];
    const privilege = privileges.find((item) => item?.id === track?.id) || null;
    const alias = Array.isArray(track?.alia) ? track.alia.filter(Boolean) : [];
    const picIdRaw =
      track?.al?.pic_str ||
      (typeof track?.al?.pic === 'number' ? track.al.pic.toString() : track?.al?.pic) ||
      track?.al?.picId ||
      track?.pic ||
      track?.id;

    const normalizedDuration = (() => {
      if (typeof track?.duration === 'number' && Number.isFinite(track.duration)) {
        return track.duration;
      }
      if (typeof track?.dt === 'number' && Number.isFinite(track.dt)) {
        return Math.round(track.dt / 1000);
      }
      return 0;
    })();

    return {
      id: toSafeString(track?.id) || `${index}`,
      rank: index + 1,
      name: track?.name || track?.mainTitle || '',
      alias,
      artists,
      album: track?.al?.name || '',
      albumId: toSafeString(track?.al?.id),
      duration: normalizedDuration,
      fee: track?.fee ?? privilege?.fee ?? 0,
      source,
      picId: picIdRaw ? picIdRaw.toString() : null,
      coverImgUrl: track?.al?.picUrl || null,
      privilege
    };
  });

  return {
    id: toSafeString(playlist.id),
    name: playlist.name,
    description: playlist.description || playlist.detailPageTitle || '',
    coverImgUrl: playlist.coverImgUrl || null,
    trackCount: playlist.trackCount ?? tracks.length,
    updateTime: playlist.updateTime || playlist.trackUpdateTime || null,
    updateFrequency: playlist.updateFrequency || null,
    subscribedCount: playlist.subscribedCount ?? null,
    playCount: playlist.playCount ?? null,
    tags: Array.isArray(playlist.tags) ? playlist.tags : [],
    source,
    tracks
  };
};

const DEFAULT_CHART_TRACK_LIMIT = 20;

const chartCache = new Map();

const buildChartDefinitions = (config) => {
  const playlists = config.charts?.netease?.playlists;
  if (!Array.isArray(playlists)) {
    return [];
  }
  const defaultSource = config.charts?.netease?.defaultSource || 'netease';
  return playlists
    .map((item) => {
      if (!item || !item.id || !item.key) return null;
      return {
        ...item,
        key: item.key.toString(),
        id: item.id.toString(),
        source: (item.source || defaultSource).toString(),
        cacheTtlMs: item.cacheTtlMs
      };
    })
    .filter(Boolean);
};

const findChartDefinition = (config, keyOrId) => {
  if (!keyOrId) return null;
  const normalizedKey = keyOrId.toString();
  return buildChartDefinitions(config).find(
    (item) => item.key === normalizedKey || item.id === normalizedKey
  );
};

const withTrackLimit = (chart, limit = DEFAULT_CHART_TRACK_LIMIT) => {
  const nextLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_CHART_TRACK_LIMIT;
  return {
    ...chart,
    tracks: Array.isArray(chart.tracks) ? chart.tracks.slice(0, nextLimit) : []
  };
};

const fetchChartPayload = async (definition, ttlFallback) => {
  const cacheKey = definition.key;
  const ttl = definition.cacheTtlMs ?? ttlFallback ?? 1000 * 60 * 5;
  const now = Date.now();
  const cached = chartCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }
  const raw = await fetchPlaylistDetail(definition.id, definition.source);
  const basePayload = normalizeChartPlaylist(raw, definition.source);
  const payload = {
    ...basePayload,
    key: definition.key,
    name: definition.name || basePayload.name,
    label: definition.label || definition.name || basePayload.name,
    description: definition.description || basePayload.description,
    shortDescription:
      definition.shortDescription || definition.description || basePayload.description,
    category: definition.category || null
  };
  chartCache.set(cacheKey, { payload, expiresAt: now + ttl });
  return payload;
};

const createRouter = ({ taskStore, downloadManager, libraryService, config }) => {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  router.get('/charts', async (req, res, next) => {
    try {
      const limit = Number.parseInt(req.query.limit, 10);
      const definitions = buildChartDefinitions(config);
      if (definitions.length === 0) {
        return res.json([]);
      }
      const ttl = config.charts?.cacheTtlMs;
      const results = await Promise.allSettled(
        definitions.map((definition) => fetchChartPayload(definition, ttl))
      );
      const payload = results
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return withTrackLimit(result.value, limit);
          }
          console.warn(
            `Failed to fetch chart ${definitions[index]?.key}:`,
            result.reason?.message || result.reason
          );
          return null;
        })
        .filter(Boolean);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get('/charts/:key', async (req, res, next) => {
    try {
      const { key } = req.params;
      const limit = Number.parseInt(req.query.limit, 10);
      const definition = findChartDefinition(config, key);
      if (!definition) {
        return res.status(404).json({ error: 'chart not found' });
      }
      const ttl = config.charts?.cacheTtlMs;
      const payload = await fetchChartPayload(definition, ttl);
      res.json(withTrackLimit(payload, limit));
    } catch (error) {
      next(error);
    }
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

      const existingTask = taskStore
        .listTasks()
        .find((task) => task.trackId === trackId && task.source === source && task.status !== 'failed');
      if (existingTask) {
        return res.status(200).json(existingTask);
      }

      const existingTrack = db.getTrackBySourceTrack(trackId, source);
      if (existingTrack) {
        return res.status(200).json({
          id: `existing-${existingTrack.id}`,
          trackId,
          source,
          title: existingTrack.title,
          artist: existingTrack.artist || 'Unknown Artist',
          album: existingTrack.album_name || 'Unknown Album',
          status: 'completed',
          progress: 1,
          libraryTrackId: existingTrack.id,
          libraryAlbumId: existingTrack.album_id || null,
          existing: true
        });
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
