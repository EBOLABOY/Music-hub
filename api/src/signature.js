import crypto from 'crypto';
import config from './config.js';

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
  const raw = encodeURIComponent(String(keyword ?? ''));
  return md5Tail(buildBasePayload(raw, timestamp));
};

export const buildUrlSignature = (trackId, timestamp) => {
  const raw = encodeURIComponent(String(trackId ?? ''));
  return md5Tail(buildBasePayload(raw, timestamp));
};
