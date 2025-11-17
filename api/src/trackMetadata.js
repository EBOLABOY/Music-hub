import axios from 'axios';

const NETEASE_DETAIL_ENDPOINT = 'https://music.163.com/api/song/detail/';
const NETEASE_REFERER = 'https://music.163.com/';
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

const buildBaseMetadata = ({ trackId, source, fallback = {} }) => {
  const artistsArray = toArray(fallback.artist);
  const baseArtist = artistsArray.join(', ') || fallback.artist || 'Unknown Artist';
  return {
    trackId,
    source,
    title: fallback.title || `track-${trackId}`,
    album: fallback.album || 'Unknown Album',
    artist: baseArtist,
    artists: artistsArray,
    albumArtist: fallback.albumArtist || baseArtist,
    trackNumber: fallback.trackNumber || null,
    discNumber: fallback.discNumber || null,
    releaseYear: fallback.releaseYear || null,
    coverUrl: fallback.coverUrl || null
  };
};

const parsePublishYear = (publishTime) => {
  if (!publishTime) return null;
  const timestamp = typeof publishTime === 'number' ? publishTime : Number(publishTime);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }
  return new Date(timestamp).getFullYear();
};

const parseNeteaseMetadata = (song) => {
  if (!song) return null;
  const album = song.album || song.al || {};
  const rawArtists = song.artists || song.ar || [];
  const artists = rawArtists
    .map((artist) => artist?.name)
    .filter(Boolean)
    .map((name) => name.trim());
  const albumArtists = album.artists || album.ar || [];
  const albumArtistName =
    album.artist?.name ||
    (Array.isArray(albumArtists) && albumArtists.length > 0 ? albumArtists[0]?.name : null) ||
    artists[0] ||
    null;

  const trackNumber = Number.isFinite(song.no) ? song.no : parseInt(song.no, 10);
  const discNumberRaw = song.disc || song.cd;
  const discNumber =
    typeof discNumberRaw === 'number'
      ? discNumberRaw
      : discNumberRaw
      ? parseInt(discNumberRaw, 10)
      : null;

  return {
    title: song.name || null,
    album: album.name || null,
    artist: artists.length > 0 ? artists.join(', ') : null,
    artists,
    albumArtist: albumArtistName,
    trackNumber: Number.isFinite(trackNumber) ? trackNumber : null,
    discNumber: Number.isFinite(discNumber) ? discNumber : null,
    releaseYear: parsePublishYear(album.publishTime) || parsePublishYear(song.publishTime) || null,
    coverUrl: album.picUrl || album.blurPicUrl || album.coverImgUrl || null
  };
};

const createNeteaseClient = (userAgent = DEFAULT_UA) =>
  axios.create({
    baseURL: NETEASE_DETAIL_ENDPOINT,
    headers: {
      'User-Agent': userAgent,
      Referer: NETEASE_REFERER,
      'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8'
    },
    timeout: 8000
  });

const neteaseClients = new Map();

const getNeteaseClient = (userAgent = DEFAULT_UA) => {
  if (!neteaseClients.has(userAgent)) {
    neteaseClients.set(userAgent, createNeteaseClient(userAgent));
  }
  return neteaseClients.get(userAgent);
};

const fetchNeteaseDetail = async (trackId, config) => {
  try {
    const client = getNeteaseClient(config?.musicSource?.userAgent);
    const { data } = await client.get('', {
      params: {
        ids: `[${trackId}]`
      }
    });
    const song = data?.songs?.[0];
    return parseNeteaseMetadata(song);
  } catch (error) {
    console.warn(`Failed to fetch NetEase metadata for ${trackId}: ${error.message}`);
    return null;
  }
};

export const fetchTrackMetadata = async ({ trackId, source, fallback, config }) => {
  const base = buildBaseMetadata({ trackId, source, fallback });
  if (!trackId || !source) {
    return base;
  }

  if (source === 'netease') {
    const detail = await fetchNeteaseDetail(trackId, config);
    if (detail) {
      return {
        ...base,
        ...detail,
        artist: detail.artist || base.artist,
        artists: Array.isArray(detail.artists) && detail.artists.length > 0 ? detail.artists : base.artists,
        album: detail.album || base.album,
        albumArtist: detail.albumArtist || base.albumArtist,
        trackNumber: detail.trackNumber ?? base.trackNumber,
        discNumber: detail.discNumber ?? base.discNumber,
        releaseYear: detail.releaseYear ?? base.releaseYear,
        coverUrl: detail.coverUrl || base.coverUrl
      };
    }
  }

  return base;
};

export default fetchTrackMetadata;
