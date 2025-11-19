import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Disc, HardDrive, Music2, Play, RefreshCw, Terminal, X } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  api,
  type AlbumDetail,
  type MediaAlbum,
  type MediaTrack,
  type ScannerStatus
} from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PlayerBar } from '@/components/PlayerBar';
import { cn } from '@/lib/utils';

export function LibraryPage() {
  const queryClient = useQueryClient();
  const [showScanner, setShowScanner] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MediaTrack | null>(null);
  const [playlist, setPlaylist] = useState<MediaTrack[]>([]);

  const { data: status = { isScanning: false, logs: [] } } = useQuery<ScannerStatus>({
    queryKey: ['scannerStatus'],
    queryFn: api.getScannerStatus,
    refetchInterval: (data) => (data?.isScanning ? 1000 : 5000)
  });

  const { data: albums = [] } = useQuery<MediaAlbum[]>({
    queryKey: ['albums'],
    queryFn: api.getAlbums,
    staleTime: 60_000
  });

  const { data: selectedAlbumDetail } = useQuery<AlbumDetail>({
    queryKey: ['album', selectedAlbumId],
    queryFn: () => api.getAlbumDetail(selectedAlbumId!),
    enabled: Boolean(selectedAlbumId)
  });

  const { mutate: runScanner } = useMutation<{ success?: boolean }, Error>({
    mutationFn: api.runScanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scannerStatus'] });
      toast.success('扫描任务已提交');
    },
    onError: (error) => toast.error(error.message || '启动扫描失败')
  });

  const playTrack = (track: MediaTrack, trackList: MediaTrack[]) => {
    setCurrentTrack(track);
    setPlaylist(trackList);
  };

  const handleNext = () => {
    if (!currentTrack || playlist.length === 0) return;
    const index = playlist.findIndex((t) => t.id === currentTrack.id);
    if (index >= 0 && index < playlist.length - 1) {
      setCurrentTrack(playlist[index + 1]);
    }
  };

  const handlePrev = () => {
    if (!currentTrack || playlist.length === 0) return;
    const index = playlist.findIndex((t) => t.id === currentTrack.id);
    if (index > 0) {
      setCurrentTrack(playlist[index - 1]);
    }
  };

  const currentAlbumCover = currentTrack ? api.getCoverUrl('track', currentTrack.id) : undefined;

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          我的媒体库
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowScanner((prev) => !prev)}>
          {showScanner ? '隐藏维护工具' : '媒体库维护'}
        </Button>
      </div>

      {showScanner && (
        <div className="grid gap-6 animate-in slide-in-from-top-4 duration-200">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">扫描与索引</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-start gap-6 rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50 md:flex-row md:items-center">
                <div className="rounded-full bg-white p-4 shadow-sm dark:bg-gray-800">
                  <HardDrive className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 font-medium">全量扫描</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    扫描下载目录，修复元数据并重建索引数据库。
                  </p>
                </div>
                <Button onClick={() => runScanner()} disabled={status.isScanning}>
                  {status.isScanning ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      扫描中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      开始扫描
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-mono">
                <Terminal className="h-4 w-4" />
                Scanner Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              <div className="h-32 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-xs text-gray-300 shadow-inner">
                {status.logs && status.logs.length > 0 ? (
                  <ul className="space-y-1">
                    {status.logs.map((log, index) => (
                      <li
                        key={`${index}-${log.slice(0, 8)}`}
                        className="truncate border-l-2 border-gray-800 pl-2 hover:border-blue-500"
                      >
                        <span className="mr-2 opacity-50">[{new Date().toLocaleTimeString()}]</span>
                        {log}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-600">
                    Ready...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {albums.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mb-4 inline-flex rounded-full bg-gray-100 p-6 dark:bg-gray-800">
            <Disc className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">媒体库为空</h3>
          <p className="mt-2 text-gray-500">
            快去搜索下载一些音乐，或者点击上方“媒体库维护”进行扫描。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {albums.map((album) => (
            <div
              key={album.id}
              className="group relative flex cursor-pointer flex-col transition-transform hover:-translate-y-1"
              onClick={() => setSelectedAlbumId(album.id)}
            >
              <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-gray-200 shadow-sm transition-shadow group-hover:shadow-md dark:bg-gray-800">
                {album.cover_path ? (
                  <img
                    src={api.getCoverUrl('album', album.id)}
                    alt={album.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music2 className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
                    <Play className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              <h3
                className="truncate font-semibold leading-tight text-gray-900 dark:text-gray-100"
                title={album.name}
              >
                {album.name}
              </h3>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{album.artist}</p>
              <p className="mt-0.5 text-xs text-gray-400">{album.year || ''}</p>
            </div>
          ))}
        </div>
      )}

      {selectedAlbumId && selectedAlbumDetail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedAlbumId(null)}
          />
          <div className="relative flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900 md:flex-row">
            <button
              type="button"
              onClick={() => setSelectedAlbumId(null)}
              className="absolute right-4 top-4 rounded-full bg-black/10 p-2 text-gray-800 transition hover:bg-black/20 dark:bg-white/10 dark:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex w-full flex-col items-center border-r border-gray-100 bg-gray-50 p-8 text-center dark:border-gray-800 dark:bg-gray-950 md:w-80">
              <div className="mb-6 h-48 w-48 overflow-hidden rounded-lg shadow-xl md:h-56 md:w-56">
                {selectedAlbumDetail.cover_path ? (
                  <img
                    src={api.getCoverUrl('album', selectedAlbumDetail.id)}
                    alt="Cover"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-200 dark:bg-gray-800">
                    <Disc className="h-20 w-20 text-gray-400" />
                  </div>
                )}
              </div>
              <h2 className="mb-2 text-2xl font-bold leading-tight text-gray-900 dark:text-gray-50">
                {selectedAlbumDetail.name}
              </h2>
              <p className="mb-1 text-lg font-medium text-blue-600 dark:text-blue-400">
                {selectedAlbumDetail.artist}
              </p>
              <p className="text-sm text-gray-500">
                {selectedAlbumDetail.year || 'Unknown Year'} · {selectedAlbumDetail.tracks.length} Tracks
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="space-y-1">
                {selectedAlbumDetail.tracks.map((track, index) => {
                  const isCurrent = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id}
                      className={cn(
                        'group flex cursor-pointer items-center gap-4 rounded-lg p-3 transition',
                        isCurrent
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      )}
                      onClick={() => playTrack(track, selectedAlbumDetail.tracks)}
                    >
                      <div className="w-6 text-center text-sm font-mono opacity-50 group-hover:opacity-100">
                        {isCurrent ? <Play className="h-4 w-4 fill-current" /> : index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{track.title}</div>
                      </div>
                      <div className="text-xs font-mono opacity-50">
                        {`${Math.floor(track.duration / 60)}:${(Math.floor(track.duration) % 60)
                          .toString()
                          .padStart(2, '0')}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <PlayerBar
        track={currentTrack}
        onNext={handleNext}
        onPrev={handlePrev}
        albumCoverUrl={currentAlbumCover}
      />
    </div>
  );
}
