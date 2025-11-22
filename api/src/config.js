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

const defaultNeteasePlaylists = [
  {
    key: 'soaring',
    id: process.env.NETEASE_SOARING_PLAYLIST_ID || '19723756',
    name: '飙升榜',
    description: '云音乐中每天热度上升最快的单曲，每日更新。'
  },
  {
    key: 'hot',
    id: process.env.NETEASE_HOT_PLAYLIST_ID || '3778678',
    name: '热歌榜',
    description: '云音乐热度最高的单曲集合。'
  },
  {
    key: 'new',
    id: process.env.NETEASE_NEW_PLAYLIST_ID || '3779629',
    name: '新歌榜',
    description: '云音乐收录的最新热门单曲速递。'
  },
  {
    key: 'electric',
    id: process.env.NETEASE_EDM_PLAYLIST_ID || '1978921795',
    name: '电音榜',
    description: '电音爱好者不能错过的节奏精选。'
  },
  {
    key: 'euro_america',
    id: process.env.NETEASE_EURO_PLAYLIST_ID || '2809513713',
    name: '欧美热歌榜',
    description: '欧美流行乐坛热门单曲趋势。'
  },
  {
    key: 'acg',
    id: process.env.NETEASE_ACG_PLAYLIST_ID || '71385702',
    name: 'ACG 动漫榜',
    description: '二次元、游戏与动漫音乐精选。'
  },
  {
    key: 'billboard',
    id: process.env.NETEASE_BILLBOARD_PLAYLIST_ID || '60198',
    name: '美国 Billboard 榜',
    description: '美国 Billboard 公告牌排行榜精选单曲。'
  }
];
const config = {
  env: process.env.NODE_ENV || 'production',
  port: parseIntOrDefault(process.env.PORT, 4000),
  downloadDir: process.env.DOWNLOAD_DIR || '/downloads',
  taskCleanupMs: parseIntOrDefault(process.env.TASK_CLEANUP_MS, 0),
  charts: {
    cacheTtlMs: parseIntOrDefault(
      process.env.NETEASE_SOARING_CACHE_TTL_MS,
      1000 * 60 * 5
    ),
    netease: {
      defaultSource: process.env.NETEASE_SOARING_SOURCE || 'netease',
      playlists: defaultNeteasePlaylists
    }
  },
  musicSource: {
    timeEndpoint: process.env.MUSIC_TIME_ENDPOINT || 'https://www.ximalaya.com/revision/time',
    apiBase: process.env.MUSIC_API_BASE || 'https://music-api-us.gdstudio.xyz/api.php',
    downloadApiBase:
      process.env.MUSIC_DOWNLOAD_API_BASE || 'https://music-api.gdstudio.xyz/api.php',
    source: 'qobuz',
    portalHost: 'music.gdstudio.xyz',
    portalVersion: process.env.MUSIC_PORTAL_VERSION || '2025.11.4',
    stableSources: (process.env.MUSIC_STABLE_SOURCES || 'netease,kuwo,joox,tidal')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
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
  },
  library: {
    allowImportReorg: (process.env.LIBRARY_ALLOW_IMPORT_REORG || '').toLowerCase() === 'true',
    minPlanScore: parseIntOrDefault(process.env.LIBRARY_MIN_PLAN_SCORE, 2),
    fuzzyMatchThreshold: parseIntOrDefault(process.env.LIBRARY_FUZZY_THRESHOLD, 4)
  }
};

export default config;
