import {
    resolveTrackUrl,
    resolveTrackCoverUrl,
    resolveTrackLyrics
} from '../musicSource.js';
import { fetchFallbackCover, fetchFallbackLyrics } from '../fallbackAssets.js';
import { fetchTrackMetadata } from '../trackMetadata.js';
import { extractUrl, preview, buildAudioErrorPayload } from '../utils.js';
import db from '../db.js';

export class DownloadController {
    constructor({ taskStore, downloadManager, config }) {
        this.taskStore = taskStore;
        this.downloadManager = downloadManager;
        this.config = config;
    }

    listTasks(req, res) {
        const tasks = this.taskStore.listTasks();
        res.json({ tasks });
    }

    getTask(req, res) {
        const task = this.taskStore.getTask(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    }

    async createTask(req, res, next) {
        try {
            const { trackId, picId, source, title, artist, album } = req.body || {};
            if (!trackId || !source) {
                return res.status(400).json({ error: 'trackId and source are required' });
            }

            const existingTask = this.taskStore
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
            const task = this.taskStore.createTask({
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
                config: this.config
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
                this.taskStore.removeTask(task.id);
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
            const stableSources = Array.isArray(this.config.musicSource?.stableSources)
                ? this.config.musicSource.stableSources
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

            this.taskStore.attachDownloadUrl(task.id, audioResult);
            this.downloadManager.enqueue(task.id, urls, {
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
            this.taskStore.updateTask(task.id, {
                title: finalTitle,
                artist: finalArtist,
                album: finalAlbum
            });
            res.status(201).json(this.taskStore.getTask(task.id));
        } catch (error) {
            next(error);
        }
    }

    deleteTask(req, res) {
        const removed = this.taskStore.removeTask(req.params.id);
        if (!removed) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ removed: removed.id });
    }
}
