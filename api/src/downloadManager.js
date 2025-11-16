import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { sanitizeFilename, downloadSimpleFile } from './utils.js';

const DEFAULT_EXTENSION = '.mp3';
const CONTENT_TYPE_EXTENSION_MAP = {
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/aac': '.aac',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aiff': '.aiff',
  'audio/x-aiff': '.aiff',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav'
};
const FMT_EXTENSION_MAP = {
  '5': '.mp3',
  '6': '.flac',
  '7': '.flac'
};

const normalizeExtension = (ext) => {
  if (!ext) return '';
  return ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
};

const stripExtension = (filename) => filename.replace(/\.[^./\\]+$/, '');

const replaceExtension = (filename, extension) => {
  const normalized = normalizeExtension(extension) || DEFAULT_EXTENSION;
  const base = stripExtension(filename) || 'track';
  return `${base}${normalized}`;
};

const getExtensionFromContentType = (type) => {
  if (!type) return '';
  const normalized = type.split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_EXTENSION_MAP[normalized] || '';
};

const getFilenameFromDisposition = (header) => {
  if (!header) return '';
  const starMatch = header.match(/filename\*=([^;]+)/i);
  if (starMatch) {
    const value = starMatch[1].split("''").pop()?.trim() ?? '';
    const cleaned = value.replace(/^"|"$/g, '');
    try {
      return decodeURIComponent(cleaned);
    } catch (error) {
      return cleaned;
    }
  }
  const regularMatch = header.match(/filename="?([^";]+)"?/i);
  if (regularMatch) {
    return regularMatch[1];
  }
  return '';
};

const getExtensionFromDisposition = (header) => {
  const filename = getFilenameFromDisposition(header);
  if (!filename) return '';
  return path.extname(filename);
};

const getExtensionFromUrl = (downloadUrl) => {
  if (!downloadUrl) return '';
  try {
    const urlObject = new URL(downloadUrl);
    const fmt = urlObject.searchParams.get('fmt');
    if (fmt && FMT_EXTENSION_MAP[fmt]) {
      return FMT_EXTENSION_MAP[fmt];
    }
    const ext = path.extname(urlObject.pathname);
    if (ext) {
      return ext;
    }
  } catch (error) {
    const fmtMatch = downloadUrl.match(/[?&]fmt=(\d+)/);
    if (fmtMatch && FMT_EXTENSION_MAP[fmtMatch[1]]) {
      return FMT_EXTENSION_MAP[fmtMatch[1]];
    }
  }
  return '';
};

const resolveExtension = ({ headers, downloadUrl, requestedFilename }) => {
  const contentTypeExt = getExtensionFromContentType(headers?.['content-type']);
  if (contentTypeExt) return contentTypeExt;
  const dispositionExt = getExtensionFromDisposition(headers?.['content-disposition']);
  if (dispositionExt) return dispositionExt;
  const urlExt = getExtensionFromUrl(downloadUrl);
  if (urlExt) return urlExt;
  const requestedExt = path.extname(requestedFilename || '');
  if (requestedExt) return requestedExt;
  return DEFAULT_EXTENSION;
};

class DownloadManager {
  constructor({ downloadDir, taskStore, cleanupMs = 0 }) {
    this.downloadDir = downloadDir;
    this.taskStore = taskStore;
    this.cleanupMs = cleanupMs;
    this.queue = [];
    this.active = false;
  }

  enqueue(taskId, urls, metadata) {
    this.queue.push({ taskId, urls, metadata });
    const task = this.taskStore.getTask(taskId);
    if (task) {
      this.taskStore.updateTask(taskId, { status: 'queued', progress: 0 });
    }
    this.processQueue();
  }

  async processQueue() {
    if (this.active || !this.queue.length) return;
    this.active = true;
    const job = this.queue.shift();
    job.finalDir = null;
    try {
      await this.handleJob(job);
    } catch (error) {
      console.error(`download error for task ${job.taskId}:`, error.message);
      this.taskStore.updateTask(job.taskId, { status: 'failed', error: error.message });
      await this.removePartialFiles(job.finalDir);
      this.scheduleCleanup(job.taskId);
    } finally {
      this.active = false;
      this.processQueue();
    }
  }

  async handleJob(job) {
    const { taskId, urls, metadata } = job;
    const { audioUrl, coverUrl, lyricsContent } = urls;
    if (!audioUrl) {
      throw new Error('Missing audio url');
    }

    const safeArtist = sanitizeFilename(metadata?.artist || 'Unknown Artist');
    const safeAlbum = sanitizeFilename(metadata?.album || 'Unknown Album');
    const safeTitle = sanitizeFilename(metadata?.title || `track-${taskId}`);
    const finalDir = path.join(this.downloadDir, safeArtist, safeAlbum);
    job.finalDir = finalDir;
    await fs.promises.mkdir(finalDir, { recursive: true });
    this.taskStore.updateTask(taskId, { status: 'downloading', progress: 0 });

    const response = await axios({
      url: audioUrl,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        Referer: 'https://music.gdstudio.xyz/'
      },
      timeout: 30000
    });

    const resolvedExtension = resolveExtension({
      headers: response.headers,
      downloadUrl: audioUrl,
      requestedFilename: `${safeTitle}${DEFAULT_EXTENSION}`
    });
    const finalFilename = `${safeTitle}${resolvedExtension}`;
    const destPath = path.join(finalDir, finalFilename);

    const totalBytes = Number(response.headers['content-length'] || 0);
    let downloaded = 0;

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalBytes > 0) {
        const progressFraction = downloaded / totalBytes;
        this.taskStore.updateTask(taskId, { progress: progressFraction });
      }
    });

    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(destPath);
      response.data.pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      response.data.on('error', reject);
    });

    this.taskStore.updateTask(taskId, {
      status: 'completed',
      progress: 1,
      filePath: finalDir,
      files: {
        audio: destPath
      }
    });

    if (lyricsContent) {
      const lrcPath = path.join(finalDir, `${safeTitle}.lrc`);
      try {
        await fs.promises.writeFile(lrcPath, lyricsContent, 'utf8');
      } catch (error) {
        console.warn(`Failed to write lyrics file ${lrcPath}: ${error.message}`);
      }
    }

    if (coverUrl) {
      let coverExt = '.jpg';
      try {
        const coverUrlObject = new URL(coverUrl);
        const extCandidate = path.extname(coverUrlObject.pathname);
        if (extCandidate) {
          coverExt = extCandidate;
        }
      } catch (error) {
        // ignore parsing errors
      }
      const coverPath = path.join(finalDir, `cover${coverExt || '.jpg'}`);
      await downloadSimpleFile(coverUrl, coverPath);
    }

    this.scheduleCleanup(taskId);
  }

  async removePartialFiles(directory) {
    if (!directory) return;
    try {
      await fs.promises.rm(directory, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to remove partial directory ${directory}: ${error.message}`);
    }
  }

  scheduleCleanup(taskId) {
    if (this.cleanupMs > 0) {
      setTimeout(() => this.taskStore.removeTask(taskId), this.cleanupMs);
    }
  }
}

export default DownloadManager;
