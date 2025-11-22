import { fetchPlaylistDetail } from '../musicSource.js';

const DEFAULT_CHART_TRACK_LIMIT = 20;
const MAX_CHART_ITEMS = 100;
const chartCache = new Map();

const normalizeChartPlaylist = (payload, source, limit = 0) => {
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

    // Slice tracks before mapping to avoid processing unnecessary items
    const tracksToProcess =
        limit > 0 ? playlist.tracks.slice(0, limit) : playlist.tracks;

    const tracks = tracksToProcess.map((track, index) => {
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

        const toSafeString = (value) => {
            if (value === null || value === undefined) return null;
            if (typeof value === 'string') return value || null;
            if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : null;
            if (typeof value === 'bigint') return value.toString();
            return null;
        };

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

    const toSafeString = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string') return value || null;
        if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : null;
        if (typeof value === 'bigint') return value.toString();
        return null;
    };

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
    const basePayload = normalizeChartPlaylist(raw, definition.source, MAX_CHART_ITEMS);
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

export class ChartController {
    constructor(config) {
        this.config = config;
    }

    async getCharts(req, res, next) {
        try {
            const limit = Number.parseInt(req.query.limit, 10);
            const definitions = buildChartDefinitions(this.config);
            if (definitions.length === 0) {
                return res.json([]);
            }
            const ttl = this.config.charts?.cacheTtlMs;
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
    }

    async getChartByKey(req, res, next) {
        try {
            const { key } = req.params;
            const limit = Number.parseInt(req.query.limit, 10);
            const definition = findChartDefinition(this.config, key);
            if (!definition) {
                return res.status(404).json({ error: 'chart not found' });
            }
            const ttl = this.config.charts?.cacheTtlMs;
            const payload = await fetchChartPayload(definition, ttl);
            res.json(withTrackLimit(payload, limit));
        } catch (error) {
            next(error);
        }
    }
}
