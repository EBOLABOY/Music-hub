import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import NodeID3 from 'node-id3';
import flac from 'flac-metadata';
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

const formatNumber = (value, pad = 2) => {
  if (value === undefined || value === null) return null;
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const width = Math.max(pad, String(parsed).length);
  return String(parsed).padStart(width, '0');
};

const buildFilenameBase = (title, trackNumber) => {
  const safeTitle = sanitizeFilename(title || 'track');
  const formattedTrack = formatNumber(trackNumber);
  return formattedTrack ? `${formattedTrack} - ${safeTitle}` : safeTitle;
};

const buildVorbisComments = (metadata) => {
  if (!metadata) return [];
  const comments = [];
  const push = (key, value) => {
    if (value) {
      comments.push(`${key}=${value}`);
    }
  };
  push('TITLE', metadata.title);
  push('ARTIST', metadata.artist);
  push('ALBUM', metadata.album);
  if (metadata.albumArtist && metadata.albumArtist !== metadata.artist) {
    push('ALBUMARTIST', metadata.albumArtist);
  }
  if (metadata.trackNumber) {
    push('TRACKNUMBER', String(metadata.trackNumber));
  }
  if (metadata.discNumber) {
    push('DISCNUMBER', String(metadata.discNumber));
  }
  if (metadata.releaseYear) {
    push('DATE', String(metadata.releaseYear));
  }
  return comments;
};

const buildId3Tags = (metadata) => {
  if (!metadata) return null;
  const tags = {
    title: metadata.title || undefined,
    artist: metadata.artist || undefined,
    album: metadata.album || undefined,
    performerInfo: metadata.albumArtist || metadata.artist || undefined,
    albumArtist: metadata.albumArtist || metadata.artist || undefined,
    year: metadata.releaseYear ? String(metadata.releaseYear) : undefined,
    trackNumber: metadata.trackNumber ? String(metadata.trackNumber) : undefined,
    partOfSet: metadata.discNumber ? String(metadata.discNumber) : undefined
  };
  Object.keys(tags).forEach((key) => {
    if (tags[key] === undefined || tags[key] === null) {
      delete tags[key];
    }
  });
  return Object.keys(tags).length ? tags : null;
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

    const artistForPath = metadata?.albumArtist || metadata?.artist || 'Unknown Artist';
    const safeArtist = sanitizeFilename(artistForPath);
    const safeAlbum = sanitizeFilename(metadata?.album || 'Unknown Album');
    const filenameBase = buildFilenameBase(metadata?.title || `track-${taskId}`, metadata?.trackNumber);
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
      requestedFilename: `${filenameBase}${DEFAULT_EXTENSION}`
    });
    const finalFilename = `${filenameBase}${resolvedExtension}`;
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

    let lyricsPath = null;
    if (lyricsContent) {
      lyricsPath = path.join(finalDir, `${filenameBase}.lrc`);
      try {
        await fs.promises.writeFile(lyricsPath, lyricsContent, 'utf8');
      } catch (error) {
        console.warn(`Failed to write lyrics file ${lyricsPath}: ${error.message}`);
      }
    }

    let coverAsset = null;
    if (coverUrl) {
      try {
        coverAsset = await this.downloadCoverAsset(coverUrl, finalDir);
      } catch (error) {
        console.warn(`Failed to download cover for ${destPath}: ${error.message}`);
      }
    }
    try {
      await this.applyAudioMetadata(destPath, metadata);
    } catch (error) {
      console.warn(`Failed to apply metadata for ${destPath}: ${error.message}`);
    }

    this.taskStore.updateTask(taskId, {
      status: 'completed',
      progress: 1,
      filePath: finalDir,
      files: {
        audio: destPath,
        lyrics: lyricsPath,
        cover: coverAsset?.path || null
      },
      metadata: {
        title: metadata?.title || null,
        album: metadata?.album || null,
        artist: metadata?.artist || null,
        trackNumber: metadata?.trackNumber || null,
        discNumber: metadata?.discNumber || null,
        releaseYear: metadata?.releaseYear || null
      }
    });

    this.scheduleCleanup(taskId);
  }

  async downloadCoverAsset(coverUrl, finalDir) {
    let coverExt = '.jpg';
    try {
      const coverUrlObject = new URL(coverUrl);
      const extCandidate = path.extname(coverUrlObject.pathname);
      if (extCandidate) {
        coverExt = extCandidate;
      }
    } catch {
      // ignore parsing errors and fallback to jpg
    }
    const resolvedExt = coverExt || '.jpg';
    const coverPath = path.join(finalDir, `cover${resolvedExt}`);
    const success = await downloadSimpleFile(coverUrl, coverPath);
    if (!success) {
      return null;
    }
    return {
      path: coverPath
    };
  }

  async applyAudioMetadata(destPath, metadata) {
    if (!metadata) return;
    const extension = path.extname(destPath).toLowerCase();
    if (extension === '.mp3') {
      await this.writeId3Tags(destPath, metadata);
    } else if (extension === '.flac') {
      await this.writeFlacMetadata(destPath, metadata);
    }
  }

  async writeId3Tags(destPath, metadata) {
    const tags = buildId3Tags(metadata);
    if (!tags) return;
    await new Promise((resolve, reject) => {
      NodeID3.update(tags, destPath, (error) => {
        if (error) return reject(error);
        return resolve();
      });
    });
  }

  async writeFlacMetadata(destPath, metadata) {
    const vorbisComments = buildVorbisComments(metadata);
    if (!vorbisComments.length) return;

    const tempPath = `${destPath}.tmp`;
    const backupPath = `${destPath}.bak`;
    const processor = new flac.Processor();

    const shouldAppend = vorbisComments.length > 0;
    let vorbisBlock = null;

    processor.on('preprocess', function (mdb) {
      if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) {
        mdb.remove();
      }
      if (mdb.isLast && shouldAppend) {
        mdb.isLast = false;
        if (vorbisComments.length > 0) {
          vorbisBlock = flac.data.MetaDataBlockVorbisComment.create(
            true,
            'music-hub',
            vorbisComments
          );
        }
      }
    });

    processor.on('postprocess', function (mdb) {
      if (mdb.isLast) {
        if (vorbisBlock) {
          this.push(vorbisBlock.publish());
        }
        vorbisBlock = null;
      }
    });

    try {
      await pipeline(fs.createReadStream(destPath), processor, fs.createWriteStream(tempPath));
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
    let backupCreated = false;
    try {
      await fs.promises.rename(destPath, backupPath);
      backupCreated = true;
      await fs.promises.rename(tempPath, destPath);
      await fs.promises.rm(backupPath, { force: true });
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {});
      if (backupCreated) {
        await fs.promises
          .rename(backupPath, destPath)
          .catch(() => console.warn('Failed to restore original FLAC after metadata error.'));
      }
      throw error;
    }
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
