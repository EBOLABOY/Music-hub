const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const buildApiUrl = (path) => {
  if (API_BASE.startsWith('http')) {
    return `${API_BASE}${path}`;
  }
  return path.startsWith('/api') ? path : `/api${path}`;
};

export const fetchJson = async (url, options) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '请求失败');
  }

  return response.json();
};

export const api = {
  searchTracks: (query, source) => {
    return fetchJson(
      `${buildApiUrl('/api/search')}?q=${encodeURIComponent(query)}&source=${source}`
    );
  },

  getTasks: () => {
    return fetchJson(buildApiUrl('/api/downloads')).then((data) => data.tasks || []);
  },

  getScannerStatus: () => {
    return fetchJson(buildApiUrl('/api/library/status'));
  },

  startDownload: (payload) => {
    return fetchJson(buildApiUrl('/api/downloads'), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  runScanner: () => {
    return fetchJson(buildApiUrl('/api/library/scan'), {
      method: 'POST'
    });
  }
};

