import axios from 'axios';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { URLSearchParams } from 'url';
import config from './config.js';
import { buildSearchSignature, buildUrlSignature } from './signature.js';
import CloudflareCookieProvider from './cloudflareCookies.js';
import rateLimiter from './rateLimiter.js';

const resolveProxyAgent = () => {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;

  if (!proxyUrl) {
    return new https.Agent({ keepAlive: true });
  }
  return new HttpsProxyAgent(proxyUrl);
};

const agent = resolveProxyAgent();

const http = axios.create({
  headers: {
    'User-Agent': config.musicSource.userAgent,
    Accept: '*/*',
    Referer: 'https://music.gdstudio.xyz/',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8'
  },
  timeout: 10000,
  proxy: false,
  httpsAgent: agent,
  httpAgent: agent
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
  await rateLimiter.consume();
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

const pickFirstUrl = (payload) => {
  if (!payload) return null;
  if (typeof payload === 'string') return payload || null;

  if (typeof payload === 'object') {
    const directUrl = payload.url || payload.playUrl;
    if (typeof directUrl === 'string' && directUrl.trim()) {
      return directUrl;
    }

    const data = payload.data;
    if (typeof data === 'string' && data.trim()) return data;

    if (Array.isArray(data)) {
      for (const item of data) {
        const found = pickFirstUrl(item);
        if (found) return found;
      }
    } else if (typeof data === 'object' && data) {
      const found = pickFirstUrl(data);
      if (found) return found;
    }
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = pickFirstUrl(item);
      if (found) return found;
    }
  }

  return null;
};

export const resolveTrackUrl = async (trackId, source = 'qobuz') => {
  if (!trackId) {
    throw new Error('Track id is required');
  }

  const baseParams = {
    types: 'url',
    id: trackId,
    source
  };

  // 优先走稳定下载线路
  const downloadBase = config.musicSource.downloadApiBase || config.musicSource.apiBase;
  const bitrateCandidates = [config.musicSource.defaultBitrate, 999, 320, 192, 128]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const attempts = [];
  for (const br of bitrateCandidates) {
    await rateLimiter.consume();
    const payload = new URLSearchParams({
      ...baseParams,
      br: String(br)
    }).toString();
    const { data } = await http.post(downloadBase, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      params: { callback: buildCallback() },
      responseType: 'text'
    });
    const parsed = parseJSONP(data);
    attempts.push({ br, resp: parsed });
    const url = pickFirstUrl(parsed);
    if (url) return parsed;
  }

  // fallback to旧接口
  const resp = await apiRequest({ ...baseParams, br: config.musicSource.defaultBitrate });
  attempts.push({ br: config.musicSource.defaultBitrate, resp });
  return { attempts, fallback: resp };
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
