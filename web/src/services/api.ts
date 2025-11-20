const API_BASE = import.meta.env.VITE_API_BASE || '';

export type SearchSource = 'qobuz' | 'netease' | string;

export interface TrackInfo {
  id?: string;
  url_id?: string;
  trackId?: string;
  trackName?: string;
  name?: string;
  title?: string;
  source?: SearchSource;
  artist?: string | string[];
  artist_name?: string;
  album?: string;
  album_name?: string;
  albumName?: string;
  pic_id?: string;
  picId?: string;
  quality?: string;
}

export interface SearchResponse {
  results: TrackInfo[];
}

export type TaskStatus = 'pending' | 'downloading' | 'completed' | 'failed' | string;

export interface DownloadTask {
  id: string;
  title: string;
  artist: string;
  status: TaskStatus;
  progress?: number;
  bitrate?: string;
  trackId?: string;
  source?: SearchSource;
  album?: string;
  downloadUrl?: string | null;
  libraryTrackId?: string | null;
  libraryAlbumId?: string | null;
  existing?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScannerStatus {
  isScanning: boolean;
  logs: string[];
}

export interface StartDownloadPayload {
  trackId: string;
  picId: string;
  source: SearchSource;
  title: string;
  artist: string;
  album: string;
}

export type StartDownloadResponse = DownloadTask;

export interface MediaAlbum {
  id: string;
  name: string;
  artist: string;
  cover_path: string | null;
  year: number | null;
  created_at: string;
  trackCount?: number;
}

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album_id: string;
  duration: number;
  format: string;
  bitrate: number;
}

export interface AlbumDetail extends MediaAlbum {
  tracks: MediaTrack[];
}

export interface Playlist {
  id: string;
  name: string;
  created_at: string;
  cover_track_id?: string | null;
  cover_album_id?: string | null;
}

export interface PlaylistTrack extends MediaTrack {
  added_at: string;
}

export interface PlaylistDetail extends Playlist {
  tracks: PlaylistTrack[];
}

export interface ChartTrack {
  id: string;
  rank: number;
  name: string;
  alias: string[];
  artists: string[];
  album: string;
  albumId: string | null;
  duration: number;
  fee: number;
  source: SearchSource;
  picId: string | null;
  coverImgUrl: string | null;
  privilege?: Record<string, unknown> | null;
}

export interface ChartPlaylist {
  id: string | null;
  name: string;
  description: string;
  coverImgUrl: string | null;
  trackCount: number;
  updateTime: number | null;
  updateFrequency: string | null;
  subscribedCount: number | null;
  playCount: number | null;
  source: SearchSource;
  tracks: ChartTrack[];
}

export interface ChartWithMeta extends ChartPlaylist {
  key: string;
  label: string;
  shortDescription?: string | null;
  category?: string | null;
}

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (API_BASE.startsWith('http')) {
    const cleanBase = API_BASE.replace(/\/$/, '');
    return `${cleanBase}${normalizedPath}`;
  }
  return normalizedPath;
};

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '请求失败');
  }

  return response.json() as Promise<T>;
}

export const api = {
  search: (query: string, source: SearchSource = 'qobuz', page = 1) => {
    return api.searchTracks(query, source, page);
  },

  downloadTrack: (trackId: string) => {
    return Promise.reject(new Error("Use startDownload with full payload"));
  },

  startScan: () => {
    return api.runScanner();
  },

  getAlbum: (id: string) => {
    return api.getAlbumDetail(id);
  },

  searchTracks: (query: string, source: SearchSource, page = 1) => {
    const params = new URLSearchParams({
      q: query,
      source,
      page: page.toString()
    });
    return fetchJson<SearchResponse>(buildApiUrl(`/api/search?${params.toString()}`));
  },

  getTasks: () => {
    return fetchJson<{ tasks?: DownloadTask[] }>(buildApiUrl('/api/downloads')).then(
      (data) => data.tasks || []
    );
  },

  getScannerStatus: () => {
    return fetchJson<ScannerStatus>(buildApiUrl('/api/library/status'));
  },

  startDownload: (payload: StartDownloadPayload) => {
    return fetchJson<StartDownloadResponse>(buildApiUrl('/api/downloads'), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  runScanner: () => {
    return fetchJson<{ success?: boolean }>(buildApiUrl('/api/library/scan'), {
      method: 'POST'
    });
  },

  getAlbums: () => {
    return fetchJson<MediaAlbum[]>(buildApiUrl('/api/media/albums'));
  },

  getAlbumDetail: (id: string) => {
    return fetchJson<AlbumDetail>(buildApiUrl(`/api/media/albums/${id}`));
  },

  getCoverUrl: (type: 'album' | 'track', id: string) => {
    return buildApiUrl(`/api/media/cover/${type}/${id}`);
  },

  getStreamUrl: (trackId: string) => {
    return buildApiUrl(`/api/media/stream/${trackId}`);
  },

  getLyricsUrl: (trackId: string) => {
    return buildApiUrl(`/api/media/lyrics/${trackId}`);
  },

  getPlaylists: () => {
    return fetchJson<Playlist[]>(buildApiUrl('/api/playlists'));
  },

  createPlaylist: (name: string) => {
    return fetchJson<Playlist>(buildApiUrl('/api/playlists'), {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  deletePlaylist: (id: string) => {
    return fetchJson<{ success: boolean }>(buildApiUrl(`/api/playlists/${id}`), {
      method: 'DELETE'
    });
  },

  getPlaylist: (id: string) => {
    return fetchJson<PlaylistDetail>(buildApiUrl(`/api/playlists/${id}`));
  },

  addTrackToPlaylist: (playlistId: string, trackId: string) => {
    return fetchJson<{ success: boolean }>(buildApiUrl(`/api/playlists/${playlistId}/tracks`), {
      method: 'POST',
      body: JSON.stringify({ trackId })
    });
  },

  removeTrackFromPlaylist: (playlistId: string, trackId: string) => {
    return fetchJson<{ success: boolean }>(
      buildApiUrl(`/api/playlists/${playlistId}/tracks/${trackId}`),
      {
        method: 'DELETE'
      }
    );
  },

  getCharts: (limit = 10) => {
    const params = new URLSearchParams({ limit: String(limit) });
    return fetchJson<ChartWithMeta[]>(buildApiUrl(`/api/charts?${params.toString()}`));
  },

  getChart: (key: string, limit = 20) => {
    const params = new URLSearchParams();
    if (limit) {
      params.set('limit', String(limit));
    }
    const query = params.toString();
    const suffix = query ? `?${query}` : '';
    return fetchJson<ChartWithMeta>(buildApiUrl(`/api/charts/${key}${suffix}`));
  },

  getSoaringChart: () => {
    return api.getChart('soaring');
  }
};
