import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import NodeID3 from 'node-id3';
import flac from 'flac-metadata';
import * as musicMetadata from 'music-metadata';
import { sanitizeFilename, downloadSimpleFile } from './utils.js';
import db from './db.js';

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

const DOWNLOAD_TIMEOUT_MS = 60000;
const MAX_DOWNLOAD_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const FATAL_STATUS_CODES = new Set([403, 404, 410]);

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    let destPath = null;
    let finalFilename = null;
    let downloadSuccess = false;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_DOWNLOAD_RETRIES && !downloadSuccess; attempt += 1) {
      if (attempt > 1) {
        console.warn(
          `[DownloadManager] Retrying task ${taskId} (${attempt}/${MAX_DOWNLOAD_RETRIES}) after failure`
        );
        this.taskStore.updateTask(taskId, { progress: 0 });
        if (destPath) {
          await fs.promises.rm(destPath, { force: true }).catch(() => {});
        }
        await delay(RETRY_DELAY_MS);
      }

      let response = null;
      let attemptDestPath = null;
      try {
        response = await axios({
          url: audioUrl,
          method: 'GET',
          responseType: 'stream',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            Referer: 'https://music.gdstudio.xyz/'
          },
          timeout: DOWNLOAD_TIMEOUT_MS
        });

        const resolvedExtension = resolveExtension({
          headers: response.headers,
          downloadUrl: audioUrl,
          requestedFilename: `${filenameBase}${DEFAULT_EXTENSION}`
        });
        finalFilename = `${filenameBase}${resolvedExtension}`;
        attemptDestPath = path.join(finalDir, finalFilename);
        destPath = attemptDestPath;

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
          const fileStream = fs.createWriteStream(attemptDestPath);
          const abort = (error) => {
            if (error) {
              response.data.destroy(error);
              fileStream.destroy(error);
            }
            reject(error);
          };

          response.data.pipe(fileStream);
          fileStream.on('finish', () => {
            if (totalBytes > 0) {
              const bytesWritten =
                typeof fileStream.bytesWritten === 'number' ? fileStream.bytesWritten : downloaded;
              if (bytesWritten < totalBytes) {
                return abort(
                  new Error(
                    `Download incomplete: expected ${totalBytes} bytes, received ${bytesWritten}`
                  )
                );
              }
            }
            return resolve();
          });
          fileStream.on('error', abort);
          response.data.on('error', abort);
        });

        downloadSuccess = true;
      } catch (error) {
        lastError = error;
        const cleanupTarget = attemptDestPath || destPath;
        if (cleanupTarget) {
          await fs.promises.rm(cleanupTarget, { force: true }).catch(() => {});
        }
        if (error.response && FATAL_STATUS_CODES.has(error.response.status)) {
          throw new Error(`Fatal server response: ${error.response.status}`);
        }
      } finally {
        if (response?.data && !response.data.destroyed) {
          response.data.destroy();
        }
      }
    }

    if (!downloadSuccess) {
      throw new Error(
        `Download failed after ${MAX_DOWNLOAD_RETRIES} attempts. Last error: ${lastError?.message || 'unknown'}`
      );
    }

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

    try {
      let parsedStats = {
        duration: 0,
        bitrate: 0,
        format: path.extname(destPath).replace('.', '') || 'mp3'
      };
      try {
        const parsed = await musicMetadata.parseFile(destPath);
        parsedStats = {
          duration: parsed?.format?.duration || 0,
          bitrate: parsed?.format?.bitrate || 0,
          format:
            parsed?.format?.container ||
            parsed?.format?.codec ||
            path.extname(destPath).replace('.', '') ||
            'mp3'
        };
      } catch (metaError) {
        console.warn(`[Indexer] Failed to parse local metadata for ${destPath}: ${metaError.message}`);
      }

      const trackMeta = {
        title: metadata?.title || path.basename(destPath, path.extname(destPath)),
        artist: metadata?.artist || 'Unknown Artist',
        album: metadata?.album || 'Unknown Album',
        year: metadata?.releaseYear || null,
        duration: parsedStats.duration || metadata?.duration || 0,
        format: parsedStats.format || path.extname(destPath).replace('.', ''),
        bitrate: parsedStats.bitrate || metadata?.bitrate || 0
      };
      db.upsertTrack(trackMeta, destPath, lyricsPath);
      console.log(`[Indexer] Added to DB: ${trackMeta.title} (${taskId})`);
    } catch (dbError) {
      console.warn(`[Indexer] Failed to index ${destPath}: ${dbError.message}`);
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
    const coverPath = path.join(finalDir, `folder${resolvedExt}`);
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
    const processor = new flac.Processor({ parseMetaDataBlocks: true });

    const shouldAppend = vorbisComments.length > 0;
    const overriddenKeys = new Set(
      vorbisComments
        .map((comment) => comment.split('=')[0]?.trim().toUpperCase())
        .filter(Boolean)
    );
    const preservedComments = [];
    let vendorString = null;
    let appendAfterCurrentBlock = false;
    let appended = false;

    processor.on('preprocess', function (mdb) {
      if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) {
        mdb.remove();
      }
      if (mdb.isLast && shouldAppend) {
        appendAfterCurrentBlock = true;
        mdb.isLast = false;
      } else {
        appendAfterCurrentBlock = false;
      }
    });

    processor.on('postprocess', function (mdb) {
      if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT && Array.isArray(mdb.comments)) {
        if (!vendorString && typeof mdb.vendor === 'string' && mdb.vendor.trim()) {
          vendorString = mdb.vendor;
        }
        for (const comment of mdb.comments) {
          const separatorIndex = comment.indexOf('=');
          if (separatorIndex === -1) {
            preservedComments.push(comment);
            continue;
          }
          const key = comment.slice(0, separatorIndex).trim().toUpperCase();
          if (!overriddenKeys.has(key)) {
            preservedComments.push(comment);
          }
        }
      }

      if (appendAfterCurrentBlock && shouldAppend && !appended) {
        const mergedComments = [...preservedComments, ...vorbisComments];
        if (mergedComments.length) {
          const vendorToUse = vendorString?.trim() || 'music-hub';
          const mergedBlock = flac.data.MetaDataBlockVorbisComment.create(
            true,
            vendorToUse,
            mergedComments
          );
          this.push(mergedBlock.publish());
        }
        appended = true;
        appendAfterCurrentBlock = false;
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
