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

export interface StartDownloadResponse {
  taskId?: string;
  success?: boolean;
  message?: string;
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
  }
};

