import fs from 'fs';
import path from 'path';
import * as musicMetadata from 'music-metadata';
import {
  sanitizeFilename,
  downloadSimpleFile,
  findBestMatch,
  findBestFuzzyMatch,
  pickBetterMatch
} from './utils.js';
import { searchTracks, resolveTrackCoverUrl, resolveTrackLyrics } from './musicSource.js';
import { fetchFallbackCover, fetchFallbackLyrics } from './fallbackAssets.js';
import db from './db.js';

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav'];
const normalizeString = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const fileExists = async (targetPath) => {
  try {
    await fs.promises.access(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

class LibraryService {
  constructor(config) {
    this.config = config || {};
    this.downloadDir = config.downloadDir || null;
    this.isScanning = false;
    this.processedLogs = [];
    this.stableSources = Array.isArray(config?.musicSource?.stableSources)
      ? config.musicSource.stableSources
      : [];
    const libraryConfig = config?.library || {};
    this.allowImportReorg = Boolean(libraryConfig.allowImportReorg);
    this.minPlanScore = Number.isFinite(libraryConfig.minPlanScore) ? libraryConfig.minPlanScore : 2;
    this.fuzzyScoreThreshold = Number.isFinite(libraryConfig.fuzzyMatchThreshold)
      ? libraryConfig.fuzzyMatchThreshold
      : 4;

    if (!this.downloadDir) {
      console.warn('DOWNLOAD_DIR is not set. Library service will remain disabled.');
      return;
    }

    const segments = this.downloadDir.split(path.sep).filter(Boolean);
    this.rootScanDepth = segments.length || 1;
  }

  log(message) {
    const entry = `[${new Date().toISOString()}] ${message}`;
    console.log(`[Library] ${message}`);
    this.processedLogs.unshift(entry);
    if (this.processedLogs.length > 100) {
      this.processedLogs.pop();
    }
  }

  getStatus() {
    return {
      isScanning: this.isScanning,
      logs: this.processedLogs
    };
  }

  async runScan() {
    if (this.isScanning) {
      throw new Error('Scan already in progress.');
    }
    if (!this.downloadDir) {
      throw new Error('DOWNLOAD_DIR is not configured.');
    }

    this.isScanning = true;
    this.log('Starting full library scan...');
    try {
      await this.scanDirectory(this.downloadDir, this.rootScanDepth);
    } catch (error) {
      this.log(`Error during scan: ${error.message}`);
    } finally {
      this.isScanning = false;
      this.log('Scan finished.');
    }
  }

  async scanDirectory(directoryPath, currentDepth) {
    let entries;
    try {
      entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      this.log(`Failed to read directory ${directoryPath}: ${error.message}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      try {
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, currentDepth + 1);
        } else if (
          entry.isFile() &&
          AUDIO_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
        ) {
          if (currentDepth === this.rootScanDepth) {
            await this.processMessyFile(fullPath);
          } else {
            await this.processOrganizedFile(fullPath, directoryPath);
          }
        }
      } catch (error) {
        this.log(`Error processing ${fullPath}: ${error.message}`);
      }
    }
  }

  async _fetchDualResults(term) {
    if (!term) {
      return { qobuz: [], netease: [] };
    }
    const [qobuzResult, neteaseResult] = await Promise.allSettled([
      searchTracks(term, 'qobuz'),
      searchTracks(term, 'netease')
    ]);
    return {
      qobuz: qobuzResult.status === 'fulfilled' ? qobuzResult.value : [],
      netease: neteaseResult.status === 'fulfilled' ? neteaseResult.value : []
    };
  }

  _scoreMetadataMatch(candidate, title, artist) {
    if (!candidate || !title || !artist) {
      return 0;
    }
    const normalizedTitle = normalizeString(title);
    const normalizedArtist = normalizeString(Array.isArray(artist) ? artist.join(' ') : artist);
    if (!normalizedTitle || !normalizedArtist) {
      return 0;
    }
    const candidateTitle = normalizeString(candidate?.name || candidate?.title);
    const candidateArtistSource = Array.isArray(candidate?.artist)
      ? candidate.artist.join(' ')
      : candidate?.artist;
    const candidateArtist = normalizeString(candidateArtistSource);
    if (!candidateTitle || !candidateArtist) {
      return 0;
    }
    if (candidateTitle === normalizedTitle && candidateArtist.includes(normalizedArtist)) {
      return 2;
    }
    if (candidateArtist.includes(normalizedArtist)) {
      return 1;
    }
    return 0;
  }

  _shouldRelocateImport({ planUsed, planScore, fuzzyScore }) {
    if (!this.allowImportReorg) {
      return { allowed: false, reason: 'auto-import disabled' };
    }
    if (planUsed === 'A') {
      if (planScore >= this.minPlanScore) {
        return { allowed: true, reason: null };
      }
      return {
        allowed: false,
        reason: `plan A confidence ${planScore} < ${this.minPlanScore}`
      };
    }
    if (planUsed === 'B') {
      if (fuzzyScore >= this.fuzzyScoreThreshold) {
        return { allowed: true, reason: null };
      }
      return {
        allowed: false,
        reason: `plan B score ${fuzzyScore} < ${this.fuzzyScoreThreshold}`
      };
    }
    return { allowed: false, reason: 'unknown import plan' };
  }

  async processMessyFile(filePath) {
    const filename = path.basename(filePath);
    this.log(`Importing: ${filename}`);
    try {
      let metadata = { common: {} };
      try {
        metadata = await musicMetadata.parseFile(filePath);
      } catch (error) {
        this.log(`Metadata parse failed for ${filename}: ${error.message}`);
      }

      const baseName = filename.replace(/\.[^/.]+$/, '');
      const sanitizedName = sanitizeFilename(baseName)
        .replace(/[()]/g, ' ')
        .replace(/[_]+/g, ' ')
        .trim();
      const parsedTitle = metadata.common.title;
      const parsedArtist = metadata.common.artist || metadata.common.artists?.[0];
      const parsedAlbum = metadata.common.album || 'Unknown Album';

      let match = null;
      let planUsed = null;
      let fuzzyScore = 0;
      let title = parsedTitle;
      let artist = parsedArtist;
      let album = parsedAlbum;
      if (parsedTitle && parsedArtist) {
        this.log(`Plan A (Import): Using metadata "${parsedArtist} - ${parsedTitle}"`);
        const { qobuz, netease } = await this._fetchDualResults(parsedTitle);
        const matchQ = findBestMatch(qobuz, parsedTitle, parsedArtist);
        const matchN = findBestMatch(netease, parsedTitle, parsedArtist);
        match = pickBetterMatch(matchQ, matchN, parsedTitle, parsedArtist);
        planUsed = match ? 'A' : null;
      }

      if (!match) {
        const searchQuery = sanitizedName || baseName;
        if (!searchQuery) {
          this.log(`FAILED Import: ${filename} (Filename is empty after sanitization)`);
          return;
        }
        this.log(
          `Plan B (Import): Using filename "${searchQuery}"${
            parsedTitle && parsedArtist ? ' (Plan A failed)' : ''
          }`
        );
        const { qobuz, netease } = await this._fetchDualResults(searchQuery);
        const combined = [...(qobuz || []).slice(0, 5), ...(netease || []).slice(0, 5)];
        const fuzzyResult = findBestFuzzyMatch(combined, searchQuery, { returnScore: true });
        if (fuzzyResult?.match) {
          match = fuzzyResult.match;
          fuzzyScore = fuzzyResult.score;
          planUsed = 'B';
          artist = Array.isArray(match.artist) ? match.artist.join(', ') : match.artist || artist;
          album = match.album || match.album_name || album || 'Unknown Album';
          title = match.name || match.title || title || searchQuery;
        }
      }

      if (!match) {
        this.log(`FAILED Import: ${filename} (Could not match track via API)`);
        return;
      }

      this.log(`Matched via Plan ${planUsed || 'A/B'}: ${filename}`);

      const planScore = planUsed === 'A' ? this._scoreMetadataMatch(match, parsedTitle, parsedArtist) : 0;
      const trackId = match.id || match.trackId;
      const source = match.source || 'qobuz';
      const picId = match.pic_id || match.picId || trackId;
      if (!trackId || !source) {
        this.log(`FAILED Import: ${filename} (Matched entry missing track id or source)`);
        return;
      }

      const resolvedArtistSource = match.artist_name || match.artistName || match.artist || artist;
      const allArtists = Array.isArray(resolvedArtistSource)
        ? resolvedArtistSource.join(', ')
        : resolvedArtistSource || 'Unknown Artist';
      const primaryArtist = allArtists.split(',')[0].trim() || 'Unknown Artist';
      const finalAlbum = match.album || match.album_name || match.albumName || album;
      const finalTitle = match.name || match.title || title;

      const safeArtist = sanitizeFilename(primaryArtist || 'Unknown Artist');
      const safeAlbum = sanitizeFilename(finalAlbum || 'Unknown Album');
      const safeTitle = sanitizeFilename(finalTitle || `track-${trackId}`);
      const relocationDecision = this._shouldRelocateImport({
        planUsed: planUsed || 'A',
        planScore,
        fuzzyScore
      });
      const shouldRelocate = relocationDecision.allowed;
      const originalDir = path.dirname(filePath);
      const targetDir = shouldRelocate ? path.join(this.downloadDir, safeArtist, safeAlbum) : originalDir;
      if (shouldRelocate) {
        await fs.promises.mkdir(targetDir, { recursive: true });
      }
      const lyricsOutputPath = path.join(targetDir, `${safeTitle}.lrc`);
      const coverOutputPath = path.join(targetDir, 'folder.jpg');

      const [coverInfo, lyricInfo] = await Promise.allSettled([
        resolveTrackCoverUrl(picId || trackId, source),
        resolveTrackLyrics(trackId, source, finalTitle, allArtists, finalAlbum)
      ]);

      const coverUrl =
        coverInfo.status === 'fulfilled'
          ? coverInfo.value?.url || coverInfo.value?.data?.url || null
          : null;
      const lyricsContent = lyricInfo.status === 'fulfilled' ? lyricInfo.value : null;

      if (lyricsContent) {
        await fs.promises.writeFile(lyricsOutputPath, lyricsContent, 'utf8');
      }

      if (coverUrl) {
        if (!(await fileExists(coverOutputPath))) {
          await downloadSimpleFile(coverUrl, coverOutputPath);
        }
      }

      let finalAudioPath = filePath;
      if (shouldRelocate) {
        const extension = path.extname(filePath);
        finalAudioPath = path.join(targetDir, `${safeTitle}${extension}`);
        if (await fileExists(finalAudioPath)) {
          const timestamp = Date.now();
          finalAudioPath = path.join(targetDir, `${safeTitle}-${timestamp}${extension}`);
        }
        await fs.promises.rename(filePath, finalAudioPath);
        this.log(`SUCCESS: Imported ${filename} -> ${finalAudioPath}`);
      } else {
        const decisionNote = relocationDecision.reason ? ` (${relocationDecision.reason})` : '';
        this.log(`SAFE Import: ${filename} kept in place${decisionNote}`);
      }

      const finalLyricsPath = (await fileExists(lyricsOutputPath)) ? lyricsOutputPath : null;
      try {
        const metaForDb =
          metadata?.format && metadata?.format?.duration
            ? metadata
            : await musicMetadata.parseFile(finalAudioPath);
        db.upsertTrack(
          {
            title: finalTitle,
            artist: allArtists,
            album: finalAlbum,
            year: metaForDb?.common?.year || metadata?.common?.year || null,
            duration: metaForDb?.format?.duration || 0,
            format: metaForDb?.format?.container || path.extname(finalAudioPath).replace('.', ''),
            bitrate: metaForDb?.format?.bitrate || 0
          },
          finalAudioPath,
          finalLyricsPath
        );
      } catch (dbError) {
        this.log(`DB Index warning for ${filename}: ${dbError.message}`);
      }
    } catch (error) {
      this.log(`ERROR importing ${filename}: ${error.message}`);
    }
  }

  async processOrganizedFile(filePath, directoryPath) {
    const filename = path.basename(filePath);
    const audioName = filename.replace(/\.[^/.]+$/, '');
    const lrcPath = path.join(directoryPath, `${audioName}.lrc`);
    const coverPath = path.join(directoryPath, 'folder.jpg');

    const lrcMissing = !(await fileExists(lrcPath));
    const coverMissing = !(await fileExists(coverPath));

    if (!lrcMissing && !coverMissing) {
      return;
    }

    this.log(
      `Repairing: ${filePath} (lyrics: ${lrcMissing ? 'missing' : 'ok'}, cover: ${
        coverMissing ? 'missing' : 'ok'
      })`
    );

    try {
      const relativePath = path.relative(this.downloadDir, directoryPath);
      const parts = relativePath.split(path.sep).filter(Boolean);
      const fallbackAlbum = parts[parts.length - 1] || 'Unknown Album';
      const fallbackArtist = parts[parts.length - 2] || 'Unknown Artist';
      const fallbackTitle = audioName;

      let parsedMeta = null;
      try {
        parsedMeta = await musicMetadata.parseFile(filePath);
      } catch {
        parsedMeta = null;
      }

      const metaCommon = parsedMeta?.common || {};
      const metaArtists = metaCommon.artists && metaCommon.artists.length > 0 ? metaCommon.artists : [];

      const title = metaCommon.title || fallbackTitle;
      const artist = metaCommon.artist || metaArtists.join(', ') || fallbackArtist;
      const album = metaCommon.album || fallbackAlbum;

      const searchTerms = [
        [artist, title].filter(Boolean).join(' '),
        [artist, album, title].filter(Boolean).join(' '),
        title
      ].filter(Boolean);

      let bestMatch = null;
      for (const term of searchTerms) {
        if (!term) continue;
        const { qobuz, netease } = await this._fetchDualResults(term);
        const matchQ = findBestMatch(qobuz, title, artist);
        const matchN = findBestMatch(netease, title, artist);
        const candidate = pickBetterMatch(matchQ, matchN, title, artist);
        if (candidate) {
          bestMatch = candidate;
          break;
        }
      }

      if (!bestMatch) {
        this.log(`FAILED Repair: ${filename} (Could not find API match for metadata "${title}")`);
        return;
      }

      const trackId = bestMatch.id || bestMatch.trackId;
      const source = bestMatch.source || 'qobuz';
      const picId = bestMatch.pic_id || bestMatch.picId || trackId;
      if (!trackId || !source) {
        this.log(`FAILED Repair: ${filename} (Matched entry missing track id or source)`);
        return;
      }

      const resolvedTitle = bestMatch.name || bestMatch.title || title;
      const resolvedArtists = Array.isArray(bestMatch.artist)
        ? bestMatch.artist.join(', ')
        : bestMatch.artist || artist;
      const resolvedAlbum = bestMatch.album || bestMatch.album_name || album;
      const stableSources = this.config?.musicSource?.stableSources || [];

      if (lrcMissing) {
        try {
          let lyricsContent = await resolveTrackLyrics(
            trackId,
            source,
            resolvedTitle,
            resolvedArtists,
            resolvedAlbum
          );
          if (!lyricsContent && stableSources.length > 0) {
            const fallbackLyrics = await fetchFallbackLyrics(
              { title: resolvedTitle, artist: resolvedArtists, album: resolvedAlbum },
              stableSources
            );
            lyricsContent = fallbackLyrics?.lyrics || null;
            if (lyricsContent && fallbackLyrics?.source) {
              this.log(`Repaired ${filename}: Added lyrics via fallback source ${fallbackLyrics.source}.`);
            }
          }
          if (lyricsContent) {
            await fs.promises.writeFile(lrcPath, lyricsContent, 'utf8');
            this.log(`Repaired ${filename}: Added lyrics.`);
          }
        } catch (error) {
          this.log(`Failed to download lyrics for ${filename}: ${error.message}`);
        }
      }

      if (coverMissing) {
        try {
          let coverUrl = null;
          try {
            const coverInfo = await resolveTrackCoverUrl(picId, source);
            coverUrl = coverInfo?.url || coverInfo?.data?.url || null;
          } catch (error) {
            this.log(`Primary cover fetch failed for ${filename}: ${error.message}`);
          }

          if (!coverUrl && stableSources.length > 0) {
            const fallbackCover = await fetchFallbackCover(
              { title: resolvedTitle, artist: resolvedArtists, album: resolvedAlbum },
              stableSources
            );
            coverUrl = fallbackCover?.url || null;
            if (coverUrl && fallbackCover?.source) {
              this.log(`Repaired ${filename}: Added cover via fallback source ${fallbackCover.source}.`);
            }
          }

          if (coverUrl) {
            await downloadSimpleFile(coverUrl, coverPath);
            this.log(`Repaired ${filename}: Added cover.`);
          }
        } catch (error) {
          this.log(`Failed to download cover for ${filename}: ${error.message}`);
        }
      }

      try {
        const metaForDb = parsedMeta || (await musicMetadata.parseFile(filePath));
        const finalLyricsPath = (await fileExists(lrcPath)) ? lrcPath : null;
        db.upsertTrack(
          {
            title,
            artist,
            album,
            year: metaForDb?.common?.year || null,
            duration: metaForDb?.format?.duration || 0,
            format: metaForDb?.format?.container || path.extname(filePath).replace('.', ''),
            bitrate: metaForDb?.format?.bitrate || 0
          },
          filePath,
          finalLyricsPath
        );
      } catch (dbError) {
        this.log(`DB Index warning: ${dbError.message}`);
      }
    } catch (error) {
      this.log(`ERROR repairing ${filename}: ${error.message}`);
    }
  }
}

export default LibraryService;
