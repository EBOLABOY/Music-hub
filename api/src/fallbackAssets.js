import { searchTracks, resolveTrackCoverUrl, resolveTrackLyrics } from './musicSource.js';
import { findBestMatch } from './utils.js';

const buildQueries = ({ title, artist, album }) => {
  const safeTitle = title || '';
  const safeArtist = artist || '';
  const safeAlbum = album || '';
  const queries = [];
  if (safeArtist && safeTitle) {
    queries.push(`${safeArtist} ${safeTitle}`);
  }
  if (safeTitle) {
    queries.push(safeTitle);
  }
  if (safeArtist && safeAlbum) {
    queries.push(`${safeArtist} ${safeAlbum}`);
  }
  return queries.filter(Boolean);
};

const pickMatchFromSearch = async (source, metadata) => {
  const queries = buildQueries(metadata);
  for (const term of queries) {
    try {
      const results = await searchTracks(term, source);
      const match = findBestMatch(results, metadata.title, metadata.artist);
      if (match) {
        return match;
      }
    } catch (error) {
      console.warn(`Fallback search failed (${source}, term="${term}"): ${error.message}`);
    }
  }
  return null;
};

const extractUrl = (payload) => {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'object') {
    if (typeof payload.url === 'string') return payload.url;
    if (payload.data) {
      if (typeof payload.data === 'string') return payload.data;
      if (Array.isArray(payload.data)) {
        for (const entry of payload.data) {
          const nested = extractUrl(entry);
          if (nested) return nested;
        }
      } else if (typeof payload.data === 'object') {
        return extractUrl(payload.data);
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

export const fetchFallbackCover = async (metadata, fallbackSources = []) => {
  if (!metadata?.title || !metadata?.artist) {
    return null;
  }
  for (const source of fallbackSources) {
    try {
      const match = await pickMatchFromSearch(source, metadata);
      const picId = match?.pic_id || match?.picId;
      if (!picId) continue;
      const resp = await resolveTrackCoverUrl(picId, source);
      const url = extractUrl(resp);
      if (url) {
        return { url, source, picId };
      }
    } catch (error) {
      console.warn(`Fallback cover fetch failed (${source}): ${error.message}`);
    }
  }
  return null;
};

export const fetchFallbackLyrics = async (metadata, fallbackSources = []) => {
  if (!metadata?.title || !metadata?.artist) {
    return null;
  }
  for (const source of fallbackSources) {
    try {
      const match = await pickMatchFromSearch(source, metadata);
      const lyricId = match?.lyric_id || match?.lyricId || match?.id;
      if (!lyricId) continue;
      const lyrics = await resolveTrackLyrics(
        lyricId,
        source,
        match?.name || match?.title || metadata.title,
        Array.isArray(match?.artist) ? match.artist.join(', ') : match?.artist || metadata.artist,
        match?.album || metadata.album
      );
      if (lyrics) {
        return { lyrics, source, lyricId };
      }
    } catch (error) {
      console.warn(`Fallback lyric fetch failed (${source}): ${error.message}`);
    }
  }
  return null;
};

