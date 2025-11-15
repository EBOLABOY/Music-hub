import axios from 'axios';
import config from './config.js';
import { buildSearchSignature, buildUrlSignature } from './signature.js';
import CloudflareCookieProvider from './cloudflareCookies.js';

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

export const searchTracks = async (query) => {
  if (!query) return [];
  const timestamp = await fetchServerTime();
  const callback = buildCallback();
  const params = {
    callback,
    types: 'search',
    count: config.musicSource.pageSize,
    source: config.musicSource.source,
    pages: 1,
    name: query,
    _: timestamp
  };
  params.s = buildSearchSignature(query, timestamp);
  const cookieHeader = await cloudflareCookies.getCookieHeader();
  const { data } = await http.get(config.musicSource.apiBase, {
    params,
    responseType: 'text',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined
  });
  const parsed = parseJSONP(data);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.data)) return parsed.data;
  if (Array.isArray(parsed?.result)) return parsed.result;
  return parsed;
};

export const resolveTrackUrl = async (trackId) => {
  if (!trackId) {
    throw new Error('Track id is required');
  }
  const timestamp = await fetchServerTime();
  const callback = buildCallback();
  const params = {
    callback,
    types: 'url',
    id: trackId,
    source: config.musicSource.source,
    br: config.musicSource.defaultBitrate,
    _: timestamp
  };
  params.s = buildUrlSignature(trackId, timestamp);
  const cookieHeader = await cloudflareCookies.getCookieHeader();
  const { data } = await http.get(config.musicSource.apiBase, {
    params,
    responseType: 'text',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined
  });
  const parsed = parseJSONP(data);
  return parsed;
};
