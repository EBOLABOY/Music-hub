import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const buildApiUrl = (path) => {
  if (API_BASE.startsWith('http')) {
    return `${API_BASE}${path}`;
  }
  return path.startsWith('/api') ? path : `/api${path}`;
};

const fetchJson = async (url, options) => {
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

const normalizeTrackTitle = (track) => {
  if (!track) return '未命名';
  if (typeof track === 'string') return track;
  return track.name || track.title || track.trackName || '未命名';
};

const DownloadIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [downloadingIds, setDownloadingIds] = useState(new Set());

  const fetchTasks = useCallback(async () => {
    try {
      const data = await fetchJson(buildApiUrl('/api/downloads'));
      setTasks(data.tasks || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    const raw = query;
    if (!raw.trim()) return;
    setSearching(true);
    setError('');
    try {
      const data = await fetchJson(`${buildApiUrl('/api/search')}?q=${encodeURIComponent(raw)}`);
      const list = Array.isArray(data.results) ? data.results : [];
      setResults(list);
    } catch (err) {
      setError(err.message || '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = useCallback(
    async (track) => {
      const trackId = track.id || track.url_id || track.trackId;
      if (!trackId) {
        setError('无法确定歌曲ID');
        return;
      }
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.add(trackId);
        return next;
      });
      setError('');
      try {
        const payload = {
          trackId,
          title: normalizeTrackTitle(track),
          artist: Array.isArray(track.artist) ? track.artist.join(', ') : track.artist || track.artist_name
        };
        await fetchJson(buildApiUrl('/api/downloads'), {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        fetchTasks();
      } catch (err) {
        setError(err.message || '无法创建下载任务');
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
      }
    },
    [fetchTasks]
  );

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'completed' && task.status !== 'failed'),
    [tasks]
  );

  const enqueuedTrackIds = useMemo(() => new Set(tasks.map((t) => t.trackId)), [tasks]);

  return (
    <div className="app-shell">
      <header>
        <h1>Music Hub</h1>
        <p>搜索音乐并通过 NAS 下载（内置下载器）</p>
      </header>

      <section className="card">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="输入歌曲名..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={searching}>
            {searching ? '搜索中...' : '搜索'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>搜索结果</h2>
        {results.length === 0 && !searching && <p className="muted">暂无结果</p>}
        <ul className="result-list">
          {results.map((track) => {
            const trackId = track.id || track.url_id || track.trackId;
            const isDownloading = downloadingIds.has(trackId);
            const isEnqueued = enqueuedTrackIds.has(trackId);
            const isDisabled = isDownloading || isEnqueued;
            let buttonContent = <DownloadIcon />;
            if (isDownloading) buttonContent = '...';
            if (isEnqueued) buttonContent = '队列中';

            return (
              <li key={`${track.id}-${track.url_id}`}>
                <div className="track-title">
                  <strong>{normalizeTrackTitle(track)}</strong>
                </div>
                <div className="track-artist muted">
                  {Array.isArray(track.artist) ? track.artist.join(', ') : track.artist || '未知艺术家'}
                </div>
                <button
                  onClick={() => handleDownload(track)}
                  disabled={isDisabled}
                  className={isDownloading ? 'btn-loading' : ''}
                  style={{ minWidth: '60px' }}
                >
                  {buttonContent}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2>正在进行的任务</h2>
        {activeTasks.length === 0 && <p className="muted">暂无任务（任务完成后会自动清理）</p>}
        <ul className="task-list">
          {activeTasks.map((task) => (
            <li key={task.id} style={{ display: 'block' }}>
              <div>
                <div>
                  <strong>{task.title}</strong>
                  <span className="muted"> {task.artist}</span>
                </div>
                <div className="muted" style={{ marginTop: '0.25rem' }}>
                  状态：{task.status} | 进度：{Math.round((task.progress || 0) * 100) / 100}%
                </div>
              </div>

              {task.status === 'downloading' && (
                <div className="task-progress">
                  <div
                    className="task-progress-bar"
                    style={{ width: `${Math.round((task.progress || 0) * 100) / 100}%` }}
                  ></div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
