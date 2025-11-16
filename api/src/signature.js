import crypto from 'crypto';
import config from './config.js';

const customUrlEncode = (str) => {
  if (str === null || typeof str === 'undefined') return '';
  return encodeURIComponent(String(str))
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/!/g, '%21');
};

const padVersionPart = (part) => part.padStart(2, '0');

const packVersion = (version) =>
  version
    .split('.')
    .map((part) => padVersionPart(part))
    .join('');

const buildBasePayload = (id, timestamp) => {
  const host = config.musicSource.portalHost;
  const versionPacked = packVersion(config.musicSource.portalVersion);
  const ts = String(timestamp ?? '').slice(0, 9);
  return `${host}|${versionPacked}|${ts}|${id}`;
};

const md5Tail = (payload) =>
  crypto.createHash('md5').update(payload).digest('hex').slice(-8).toUpperCase();

export const buildSearchSignature = (keyword, timestamp) => {
  const raw = customUrlEncode(keyword);
  return md5Tail(buildBasePayload(raw, timestamp));
};

export const buildUrlSignature = (trackId, timestamp) => {
  const raw = customUrlEncode(trackId);
  return md5Tail(buildBasePayload(raw, timestamp));
};
