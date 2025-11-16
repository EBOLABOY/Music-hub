import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import { Header } from './components/layout/Header.jsx';
import { StatusOverview } from './components/layout/StatusOverview.jsx';
import { SearchForm } from './components/search/SearchForm.jsx';
import { SearchResults } from './components/search/SearchResults.jsx';
import { TaskList } from './components/tasks/TaskList.jsx';
import { ScannerPanel } from './components/scanner/ScannerPanel.jsx';
import { api } from './services/api.js';

const normalizeTrackTitle = (track) => {
  if (!track) return '未命名';
  if (typeof track === 'string') return track;
  return track.name || track.title || track.trackName || '未命名';
};

const getInitialTheme = () => {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

function App() {
  const [query, setQuery] = useState('');
  const [searchSource, setSearchSource] = useState('qobuz');
  const [theme, setTheme] = useState(getInitialTheme);

  const queryClient = useQueryClient();

  const { data: activeTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.getTasks,
    refetchInterval: 5000,
    select: (tasks) =>
      tasks.filter((task) => task.status !== 'completed' && task.status !== 'failed')
  });

  const { data: scannerStatus = { isScanning: false, logs: [] } } = useQuery({
    queryKey: ['scannerStatus'],
    queryFn: api.getScannerStatus,
    refetchInterval: 5000,
    initialData: { isScanning: false, logs: [] }
  });

  const {
    mutate: runSearch,
    data: searchData,
    isPending: isSearching
  } = useMutation({
    mutationFn: ({ keyword, source }) => api.searchTracks(keyword, source),
    onError: (err) => toast.error(err.message || '搜索失败')
  });

  const handleSearch = useCallback(
    (event) => {
      event.preventDefault();
      const raw = query.trim();
      if (!raw) return;
      runSearch({ keyword: raw, source: searchSource });
    },
    [query, searchSource, runSearch]
  );

  const { mutate: runScanner } = useMutation({
    mutationFn: api.runScanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scannerStatus'] });
      toast.success('扫描已启动');
    },
    onError: (err) => toast.error(err.message || '无法启动扫描')
  });

  const {
    mutate: startDownload,
    isPending: isDownloadingAny
  } = useMutation({
    mutationFn: api.startDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('已添加下载任务');
    },
    onError: (err) => toast.error(err.message || '下载失败')
  });

  const handleDownload = useCallback(
    (track) => {
      const trackId = track.id || track.url_id || track.trackId;
      const trackSource = track.source || searchSource;
      const picId = track.pic_id || track.picId || track.id || trackId;
      if (!trackId || !trackSource) {
        toast.error('无法确定歌曲ID或来源');
        return;
      }

      const trackTitle = normalizeTrackTitle(track);
      const artistName =
        Array.isArray(track.artist) && track.artist.length > 0
          ? track.artist.join(', ')
          : track.artist || track.artist_name || 'Unknown Artist';
      const albumName = track.album || track.album_name || track.albumName || 'Unknown Album';
      const payload = {
        trackId,
        picId,
        source: trackSource,
        title: trackTitle,
        artist: artistName,
        album: albumName
      };

      startDownload(payload);
    },
    [searchSource, startDownload]
  );

  const handleRunScanner = useCallback(() => {
    runScanner();
  }, [runScanner]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const results = useMemo(() => {
    const list = Array.isArray(searchData?.results) ? searchData.results : [];
    return list;
  }, [searchData]);

  const enqueuedTrackIds = useMemo(
    () => new Set(activeTasks.map((task) => `${task.trackId}-${task.source || 'qobuz'}`)),
    [activeTasks]
  );

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-200/70 to-slate-100 dark:from-gray-950 dark:via-slate-900 dark:to-gray-950 transition-colors text-gray-900 dark:text-gray-100">
        <Toaster />
        <div className="max-w-6xl mx-auto px-4 py-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Header theme={theme} onToggleTheme={toggleTheme} />
            <StatusOverview
              activeCount={activeTasks.length}
              resultsCount={results.length}
              scannerStatus={scannerStatus}
            />
            <SearchForm
              query={query}
              onQueryChange={setQuery}
              onSubmit={handleSearch}
              searching={isSearching}
              searchSource={searchSource}
              onSourceChange={setSearchSource}
            />
            <SearchResults
              results={results}
              searching={isSearching}
              searchSource={searchSource}
              onDownload={handleDownload}
              isDownloadPending={isDownloadingAny}
              enqueuedTrackIds={enqueuedTrackIds}
              formatTrackTitle={normalizeTrackTitle}
            />
          </div>

          <div className="space-y-6">
            <TaskList tasks={activeTasks} />
            <ScannerPanel scannerStatus={scannerStatus} onRunScanner={handleRunScanner} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
