import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });
dotenv.config();

const parseIntOrDefault = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const config = {
  env: process.env.NODE_ENV || 'production',
  port: parseIntOrDefault(process.env.PORT, 4000),
  downloadDir: process.env.DOWNLOAD_DIR || '/downloads',
  taskCleanupMs: parseIntOrDefault(process.env.TASK_CLEANUP_MS, 0),
  musicSource: {
    timeEndpoint: process.env.MUSIC_TIME_ENDPOINT || 'https://www.ximalaya.com/revision/time',
    apiBase: process.env.MUSIC_API_BASE || 'https://music-api-us.gdstudio.xyz/api.php',
    source: 'qobuz',
    portalHost: 'music.gdstudio.xyz',
    portalVersion: '2025.11.4',
    pageSize: parseIntOrDefault(process.env.MUSIC_API_COUNT, 20),
    defaultBitrate: parseIntOrDefault(process.env.MUSIC_API_BITRATE, 999),
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  },
  cloudflare: {
    enabled: (process.env.CF_AUTOMATION ?? 'true') !== 'false',
    portalUrl: 'https://music.gdstudio.xyz/',
    cookieTtlMs: parseIntOrDefault(process.env.CF_COOKIE_TTL_MS, 1000 * 60 * 30),
    waitAfterLoadMs: parseIntOrDefault(process.env.CF_WAIT_AFTER_LOAD_MS, 5000),
    launchArgs: (process.env.CF_LAUNCH_ARGS || '')
      .split(',')
      .map((arg) => arg.trim())
      .filter(Boolean),
    timeoutMs: parseIntOrDefault(process.env.CF_NAVIGATION_TIMEOUT_MS, 45000)
  }
};

export default config;
