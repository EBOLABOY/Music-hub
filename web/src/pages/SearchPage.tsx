import {
  useCallback,
  useMemo,
  useState,
  type ComponentType,
  type SVGProps,
  type FormEvent
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Search as SearchIcon,
  Download,
  Loader2,
  AlertCircle,
  ChevronDown,
  Music3,
  Cloud
} from 'lucide-react';

import {
  api,
  type DownloadTask,
  type SearchResponse,
  type SearchSource,
  type StartDownloadPayload,
  type StartDownloadResponse,
  type TrackInfo
} from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

type SearchState = {
  query: string;
  source: SearchSource;
  page: number;
};

const normalizeTrackTitle = (track: TrackInfo | string | null | undefined): string => {
  if (!track) return '未命名';
  if (typeof track === 'string') return track;
  return track.name || track.title || track.trackName || '未命名';
};

const platformOptions: Array<{
  label: string;
  value: SearchSource;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  { label: 'Qobuz', value: 'qobuz', icon: Music3 },
  { label: '网易云', value: 'netease', icon: Cloud }
];

export function SearchPage() {
  const [inputQuery, setInputQuery] = useState('');
  const [searchParams, setSearchParams] = useState<SearchState>({
    query: '',
    source: 'qobuz',
    page: 1
  });
  const [processingTracks, setProcessingTracks] = useState<Set<string>>(() => new Set());

  const queryClient = useQueryClient();

  const { data: activeTasks = [] } = useQuery<DownloadTask[]>({
    queryKey: ['tasks'],
    queryFn: api.getTasks,
    refetchInterval: 5000,
    select: (tasks) => tasks.filter((task) => task.status !== 'completed' && task.status !== 'failed')
  });

  const {
    data: searchData,
    isFetching: isSearching,
    isError: isSearchError,
    error: searchError
  } = useQuery<SearchResponse>({
    queryKey: ['search', searchParams.query, searchParams.source, searchParams.page],
    queryFn: () => api.searchTracks(searchParams.query, searchParams.source, searchParams.page),
    enabled: Boolean(searchParams.query),
    staleTime: 1000 * 60 * 5,
    keepPreviousData: true
  });

  const { mutateAsync: startDownload } = useMutation<
    StartDownloadResponse,
    Error,
    StartDownloadPayload
  >({
    mutationFn: api.startDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('已添加下载任务');
    },
    onError: (err: Error) => toast.error(err.message || '下载失败')
  });

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const raw = inputQuery.trim();
      if (!raw) return;
      setSearchParams((prev) => ({ ...prev, query: raw, page: 1 }));
    },
    [inputQuery]
  );

  const handleDownload = useCallback(
    async (track: TrackInfo) => {
      const trackId = track.id || track.url_id || track.trackId;
      const trackSource = track.source || searchParams.source;
      if (!trackId || !trackSource) {
        toast.error('无效的歌曲数据');
        return;
      }

      const trackKey = `${trackId}-${trackSource}`;
      setProcessingTracks((prev) => {
        const next = new Set(prev);
        next.add(trackKey);
        return next;
      });

      const payload: StartDownloadPayload = {
        trackId,
        picId: track.pic_id || track.picId || track.id || trackId,
        source: trackSource,
        title: normalizeTrackTitle(track),
        artist:
          Array.isArray(track.artist) && track.artist.length > 0
            ? track.artist.join(', ')
            : track.artist || track.artist_name || 'Unknown Artist',
        album: track.album || track.album_name || track.albumName || 'Unknown Album'
      };

      try {
        await startDownload(payload);
      } finally {
        setProcessingTracks((prev) => {
          const next = new Set(prev);
          next.delete(trackKey);
          return next;
        });
      }
    },
    [searchParams.source, startDownload]
  );

  const results = useMemo<TrackInfo[]>(() => searchData?.results ?? [], [searchData]);
  const enqueuedTrackIds = useMemo(
    () =>
      new Set(
        activeTasks
          .map((task) => {
            const baseId = task.trackId ?? task.id;
            if (!baseId) return null;
            return `${baseId}-${task.source ?? 'qobuz'}`;
          })
          .filter((key): key is string => Boolean(key))
      ),
    [activeTasks]
  );
  const selectedPlatform =
    platformOptions.find((platform) => platform.value === searchParams.source) ||
    platformOptions[0];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>音乐搜索</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4 md:flex-row">
            <div className="flex flex-col md:flex-row gap-2 md:gap-3 items-stretch w-full">
              <div className="flex-1">
                <Input
                  placeholder="输入歌曲、艺术家或专辑..."
                  value={inputQuery}
                  onChange={(event) => setInputQuery(event.target.value)}
                />
              </div>
              <div className="relative md:w-36 w-full max-w-[11rem]">
                {selectedPlatform && (
                  <selectedPlatform.icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500 dark:text-blue-400" />
                )}
                <select
                  className="w-full h-10 appearance-none rounded-lg border border-blue-100 bg-white/90 pl-9 pr-7 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100"
                  value={searchParams.source}
                  onChange={(event) =>
                    setSearchParams((prev) => ({ ...prev, source: event.target.value, page: 1 }))
                  }
                >
                  {platformOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
              </div>
              <Button type="submit" disabled={isSearching} className="shrink-0">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <SearchIcon className="w-4 h-4 mr-2" />
                )}
                {isSearching ? '搜索中' : '搜索'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isSearchError && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3 text-red-800 dark:text-red-300">
          <AlertCircle className="w-5 h-5" />
          <span>搜索失败：{searchError?.message || '未知错误'}</span>
        </div>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">搜索结果 (第 {searchParams.page} 页)</CardTitle>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              当前展示 {results.length} 条
            </span>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((track, index) => {
                const resolvedTrackId = track.id || track.url_id || track.trackId;
                const trackSource = track.source || searchParams.source;
                const stateKey = resolvedTrackId ? `${resolvedTrackId}-${trackSource}` : null;
                const listKey = stateKey ?? `result-${index}-${trackSource}`;
                const isProcessing = stateKey ? processingTracks.has(stateKey) : false;
                const isQueued = stateKey ? enqueuedTrackIds.has(stateKey) : false;

                return (
                  <div
                    key={listKey}
                    className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
                  >
                    <div className="min-w-0 flex-1 mr-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {normalizeTrackTitle(track)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-2">
                        <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs font-mono uppercase">
                          {track.quality || 'STD'}
                        </span>
                        {Array.isArray(track.artist)
                          ? track.artist.join(', ')
                          : track.artist || 'Unknown Artist'}
                        <span className="opacity-50">·</span>
                        {track.album || 'Unknown Album'}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isQueued ? 'secondary' : 'default'}
                      disabled={isProcessing || isQueued}
                      onClick={() => handleDownload(track)}
                      className="shrink-0 min-w-[96px]"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isQueued ? (
                        <span className="text-xs">已在队列</span>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-1.5" />
                          下载
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSearchParams((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                }
                disabled={searchParams.page === 1 || isSearching}
              >
                上一页
              </Button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                第 {searchParams.page} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchParams((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={isSearching || results.length < 10}
              >
                下一页
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isSearching && !isSearchError && results.length === 0 && searchParams.query && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>未找到相关结果，请尝试更换关键词或来源。</p>
        </div>
      )}
    </div>
  );
}
