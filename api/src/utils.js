import fs from 'fs';
import axios from 'axios';

export const sanitizeFilename = (name = '') => name.replace(/[\\/:*?"<>|]/g, '_');

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
