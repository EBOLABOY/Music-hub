import axios from 'axios';
import config from './config.js';
import { buildSearchSignature, buildUrlSignature } from './signature.js';
import CloudflareCookieProvider from './cloudflareCookies.js';
import { URLSearchParams } from 'url';

const http = axios.create({
  headers: {
    'User-Agent': config.musicSource.userAgent,
    Accept: '*/*',
    Referer: 'https://music.gdstudio.xyz/',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8'
  },
  timeout: 10000
});

const cloudflareCookies = new CloudflareCookieProvider(config);

const parseJSONP = (body) => {
  if (typeof body !== 'string') return body;
  const start = body.indexOf('(');
  const end = body.lastIndexOf(')');
  if (start === -1 || end === -1) {
    throw new Error('Unexpected JSONP payload');
  }
  const json = body.slice(start + 1, end);
  return JSON.parse(json);
};

const buildCallback = () => `jQuery${Date.now()}_${Math.floor(Math.random() * 10 ** 12)}`;

const fetchServerTime = async () => {
  const { data } = await http.get(config.musicSource.timeEndpoint, {
    responseType: 'text'
  });
  const parsed = parseInt(data, 10);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const apiRequest = async ({ source = 'qobuz', ...params }) => {
  const callback = buildCallback();
  const cookieHeader = await cloudflareCookies.getCookieHeader();
  const bodyParams = { ...params, source };
  const timestamp = await fetchServerTime();

  if (bodyParams.types === 'search') {
    bodyParams.s = buildSearchSignature(bodyParams.name, timestamp);
  } else {
    bodyParams.s = buildUrlSignature(bodyParams.id, timestamp);
  }
  bodyParams._ = timestamp;

  if (source === 'netease') {
    const payload = new URLSearchParams(bodyParams).toString();
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      ...(cookieHeader ? { Cookie: cookieHeader } : {})
    };
    const { data } = await http.post(config.musicSource.apiBase, payload, {
      params: { callback },
      responseType: 'text',
      headers
    });
    return parseJSONP(data);
  }
  const { data } = await http.get(config.musicSource.apiBase, {
    params: { ...bodyParams, callback },
    responseType: 'text',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined
  });
  return parseJSONP(data);
};

const normalizeResults = (entries, source) =>
  Array.isArray(entries)
    ? entries.map((item) => ({
        ...item,
        source: item?.source || source,
        pic_id: item?.pic_id || item?.picId || item?.id
      }))
    : [];

export const searchTracks = async (query, source = 'qobuz') => {
  if (!query) return [];
  const params = {
    types: 'search',
    count: config.musicSource.pageSize,
    source,
    pages: 1,
    name: query
  };
  const parsed = await apiRequest(params);
  if (Array.isArray(parsed)) return normalizeResults(parsed, source);
  if (Array.isArray(parsed?.data)) return normalizeResults(parsed.data, source);
  if (Array.isArray(parsed?.result)) return normalizeResults(parsed.result, source);
  return normalizeResults(parsed, source);
};

export const resolveTrackUrl = async (trackId, source = 'qobuz') => {
  if (!trackId) {
    throw new Error('Track id is required');
  }
  const params = {
    types: 'url',
    id: trackId,
    source,
    br: config.musicSource.defaultBitrate
  };
  return apiRequest(params);
};

export const resolveTrackCoverUrl = async (picId, source = 'qobuz') => {
  if (!picId) {
    throw new Error('Pic id is required');
  }
  const params = {
    types: 'pic',
    id: picId,
    source,
    size: 600
  };
  return apiRequest(params);
};

export const resolveTrackLyrics = async (trackId, source = 'qobuz', title, artist, album) => {
  try {
    if (trackId) {
      const params = {
        types: 'lyric',
        id: trackId,
        source
      };
      const parsed = await apiRequest(params);
      const lyric = parsed?.lyric || parsed?.tlyric;
      if (lyric) {
        return lyric;
      }
    }
  } catch (error) {
    console.warn(`Primary lyric source (${source}) failed:`, error?.message || error);
  }

  if (!artist || !title) {
    return null;
  }

  try {
    const params = {
      artist_name: artist,
      track_name: title
    };
    if (album && album !== 'Unknown Album') {
      params.album_name = album;
    }
    const { data } = await axios.get('https://lrclib.net/api/get', {
      params,
      timeout: 5000
    });
    return data?.syncedLyrics || data?.plainLyrics || null;
  } catch (error) {
    console.warn('Fallback lyric source (lrclib) failed:', error?.message || error);
    return null;
  }
};
