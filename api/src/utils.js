import fs from 'fs';
import axios from 'axios';

const MAX_FILENAME_LENGTH = 128;

export const sanitizeFilename = (name = '') => {
  const replaced = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  if (replaced.length <= MAX_FILENAME_LENGTH) {
    return replaced;
  }
  const hash = Buffer.from(replaced).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 6);
  const sliceLength = Math.max(0, MAX_FILENAME_LENGTH - hash.length - 1);
  return `${replaced.slice(0, sliceLength)}_${hash}`;
};

export const downloadSimpleFile = async (url, destPath, options = {}) => {
  if (!url) return false;
  const { returnBuffer = false, timeout = 15000 } = options;
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        Referer: 'https://music.gdstudio.xyz/'
      },
      timeout
    });
    const buffer = Buffer.from(response.data);
    if (destPath) {
      await fs.promises.writeFile(destPath, buffer);
    }
    return returnBuffer ? buffer : true;
  } catch (error) {
    console.warn(`Failed to download extra file ${url}: ${error.message}`);
    return returnBuffer ? null : false;
  }
};

const normalize = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const getPlanAScore = (match, title, artist) => {
  const normalizedTitle = normalize(title);
  const normalizedArtist = normalize(Array.isArray(artist) ? artist.join(' ') : artist);
  if (!match) return 0;
  const itemTitle = normalize(match?.name || match?.title);
  const artistSource = Array.isArray(match?.artist) ? match.artist.join(' ') : match?.artist;
  const itemArtist = normalize(artistSource);
  if (!itemArtist) return 0;
  if (itemTitle === normalizedTitle && itemArtist.includes(normalizedArtist)) return 2;
  if (itemArtist.includes(normalizedArtist)) return 1;
  return 0;
};

export const findBestMatch = (results, title, artist) => {
  if (!Array.isArray(results) || !title || !artist) return null;
  let bestMatch = null;
  let bestScore = 0;
  for (const item of results) {
    const score = getPlanAScore(item, title, artist);
    if (score === 2) {
      return item;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }
  return bestMatch;
};

export const pickBetterMatch = (matchA, matchB, title, artist) => {
  const scoreA = getPlanAScore(matchA, title, artist);
  const scoreB = getPlanAScore(matchB, title, artist);
  if (scoreA === scoreB) {
    return matchA || matchB;
  }
  return scoreA > scoreB ? matchA : matchB;
};

export const findBestFuzzyMatch = (results, searchQuery, options = {}) => {
  const { returnScore = false } = options;
  if (!Array.isArray(results) || !searchQuery) return null;
  const normalizedQuery = normalize(searchQuery);
  if (!normalizedQuery) return null;
  let bestMatch = null;
  let bestScore = 0;
  const resultsToScore = results.slice(0, 10);

  for (const item of resultsToScore) {
    let currentScore = 0;
    const itemTitle = normalize(item?.name || item?.title);
    const artistSource = Array.isArray(item?.artist) ? item.artist.join(' ') : item?.artist;
    const itemArtist = normalize(artistSource);

    if (!itemTitle) {
      continue;
    }

    if (itemTitle === normalizedQuery) {
      currentScore += 5;
    } else if (itemTitle.includes(normalizedQuery)) {
      currentScore += 3;
    } else if (normalizedQuery.includes(itemTitle)) {
      currentScore += 2;
    }

    if (itemArtist && normalizedQuery.includes(itemArtist)) {
      currentScore += 1;
    }

    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestMatch = item;
    }
  }

  if (bestScore < 2) {
    return null;
  }

  if (returnScore) {
    return { match: bestMatch, score: bestScore };
  }

  return bestMatch;
};

export const extractUrl = (payload) => {
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

export const preview = (payload, maxLength = 600) => {
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

export const buildAudioErrorPayload = (audioInfo, trackId, source) => {
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
