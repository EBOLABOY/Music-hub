import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Music,
    Library,
    ListMusic,
    Clock,
    Download,
    Play,
    AlertCircle,
    ChevronRight,
    TrendingUp,
    Flame,
    Sparkles,
    Zap,
    Globe,
    Gamepad2,
    Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, type ChartTrack, type ChartWithMeta, type DownloadTask } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { usePlayer } from '@/contexts/PlayerContext';

type AutoPlayEntry = {
    track: ChartTrack;
    taskId: string | null;
};

export function HomePage() {
    const { playTrack, playPlaylist } = usePlayer();
    const [autoPlayQueue, setAutoPlayQueue] = useState<Record<string, { taskId: string | null; track: ChartTrack }>>({});
    const completedTaskNotifiedRef = useRef<Record<string, boolean>>({});
    const failedTaskNotifiedRef = useRef<Record<string, boolean>>({});

    const removeAutoPlayEntry = (trackId: string) => {
        setAutoPlayQueue((prev) => {
            if (!prev[trackId]) return prev;
            const next = { ...prev };
            delete next[trackId];
            return next;
        });
    };

    // 获取专辑数据
    const { data: albums = [], isLoading: isLoadingAlbums } = useQuery({
        queryKey: ['albums'],
        queryFn: api.getAlbums
    });

    // 获取歌单数据
    const { data: playlists = [] } = useQuery({
        queryKey: ['playlists'],
        queryFn: api.getPlaylists
    });

    // 获取网易云榜单
    const { data: neteaseCharts = [], isLoading: isLoadingCharts } = useQuery<ChartWithMeta[]>({
        queryKey: ['charts', 'netease'],
        queryFn: () => api.getCharts(20), // Increased limit to ensure we get all relevant charts
        staleTime: 1000 * 60 * 5
    });

    // 获取下载任务（用于显示活动任务概览）
    const { data: tasks = [] } = useQuery<DownloadTask[]>({
        queryKey: ['tasks'],
        queryFn: api.getTasks,
        refetchInterval: 5000
    });

    // 数据处理：统计和排序
    const {
        recentAlbums,
        stats,
        activeTaskCount,
        failedTaskCount
    } = useMemo(() => {
        // 1. 最近添加的 5 张专辑 (假设 API 返回的数据包含 created_at，如果没有则按原序)
        const sortedAlbums = [...albums].sort((a, b) => {
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });

        // 2. 统计数据
        // 注意：当前 api.getAlbums 返回的是专辑列表，如果包含 trackCount 最好，否则只能算专辑数
        const totalAlbums = albums.length;

        // 3. 任务状态
        const active = tasks.filter(t => t.status !== 'completed' && t.status !== 'failed').length;
        const failed = tasks.filter(t => t.status === 'failed').length;

        return {
            recentAlbums: sortedAlbums.slice(0, 5), // 只取前5张
            stats: { totalAlbums },
            activeTaskCount: active,
            failedTaskCount: failed
        };
    }, [albums, tasks]);

    const chartVisuals: Record<
        string,
        {
            icon: ComponentType<{ className?: string }>;
            color: string;
            gradient: string;
            bgGradient: string;
        }
    > = {
        soaring: {
            icon: TrendingUp,
            color: 'text-orange-500',
            gradient: 'from-orange-500 to-red-500',
            bgGradient: 'from-orange-500/10 to-red-500/5'
        },
        hot: {
            icon: Flame,
            color: 'text-red-500',
            gradient: 'from-red-500 to-rose-600',
            bgGradient: 'from-red-500/10 to-rose-600/5'
        },
        new: {
            icon: Sparkles,
            color: 'text-amber-500',
            gradient: 'from-amber-400 to-orange-500',
            bgGradient: 'from-amber-400/10 to-orange-500/5'
        },
        electric: {
            icon: Zap,
            color: 'text-blue-500',
            gradient: 'from-blue-400 to-cyan-500',
            bgGradient: 'from-blue-400/10 to-cyan-500/5'
        },
        euro_america: {
            icon: Globe,
            color: 'text-indigo-500',
            gradient: 'from-indigo-400 to-purple-500',
            bgGradient: 'from-indigo-400/10 to-purple-500/5'
        },
        acg: {
            icon: Gamepad2,
            color: 'text-emerald-500',
            gradient: 'from-emerald-400 to-teal-500',
            bgGradient: 'from-emerald-400/10 to-teal-500/5'
        }
    };

    const getChartVisual = (key: string) =>
        chartVisuals[key] || {
            icon: Music,
            color: 'text-primary',
            gradient: 'from-primary to-primary/50',
            bgGradient: 'from-primary/10 to-primary/5'
        };

    // Filter charts to only show those with defined visuals (to ensure quality and match the 6 expected charts)
    const displayCharts = useMemo(() => {
        return neteaseCharts.filter(chart => chartVisuals[chart.key]);
    }, [neteaseCharts]);

    // 播放整张专辑的第一首歌（简化的逻辑，实际可能需要获取专辑详情）
    const handlePlayAlbum = async (albumId: string) => {
        try {
            const detail = await api.getAlbumDetail(albumId);
            if (detail.tracks.length > 0) {
                // 使用 playPlaylist 播放整张专辑
                playPlaylist(detail.tracks);
            }
        } catch (e) {
            console.error("Failed to play album", e);
        }
    };

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    const formatPlayCount = (value?: number | null) => {
        if (!value) return '—';
        if (value >= 1e8) return `${(value / 1e8).toFixed(1)}亿`;
        if (value >= 1e4) return `${(value / 1e4).toFixed(1)}万`;
        return value.toLocaleString();
    };

    const formatUpdateTime = (timestamp?: number | null) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 1000 * 60 * 60 * 24) {
            return '刚刚更新';
        }
        return `${date.getMonth() + 1}月${date.getDate()}日更新`;
    };

    const queueChartTrackDownload = async (track: ChartTrack): Promise<DownloadTask> => {
        return api.startDownload({
            trackId: track.id,
            picId: track.picId || track.id,
            source: track.source || 'netease',
            title: track.name,
            artist: track.artists.join(' / ') || 'Unknown Artist',
            album: track.album || ''
        });
    };

    const handleDownloadChartTrack = async (e: React.MouseEvent, track: ChartTrack) => {
        e.stopPropagation();
        try {
            const task = await queueChartTrackDownload(track);
            if (task.existing && task.libraryTrackId) {
                toast.success('该歌曲已在本地，无需重复下载');
                return;
            }
            toast.success('已加入下载队列');
        } catch (error) {
            console.error('Download failed', error);
            toast.error('下载任务添加失败');
        }
    };

    const handlePlayChartTrack = async (track: ChartTrack) => {
        if (autoPlayQueue[track.id]) {
            toast('歌曲正在准备播放，请稍候');
            return;
        }

        setAutoPlayQueue((prev) => ({
            ...prev,
            [track.id]: { taskId: null, track }
        }));

        try {
            const task = await queueChartTrackDownload(track);

            if (task.existing && task.libraryTrackId) {
                playTrack({
                    id: task.libraryTrackId,
                    title: track.name,
                    artist: track.artists.join(' / '),
                    album: track.album || '',
                    duration: track.duration,
                    album_id: task.libraryAlbumId || undefined
                });
                toast.success('已在本地，直接播放');
                removeAutoPlayEntry(track.id);
                return;
            }

            setAutoPlayQueue((prev) => ({
                ...prev,
                [track.id]: { taskId: task.id, track }
            }));
            toast.success('已开始下载，完成后将自动播放');
        } catch (error) {
            console.error('Auto download failed', error);
            toast.error('自动下载失败，仍可稍后重试');
            removeAutoPlayEntry(track.id);
        }
    };

    useEffect(() => {
        if (!tasks.length) return;
        setAutoPlayQueue((prev) => {
            let updated = false;
            const nextQueue = { ...prev };

            Object.entries(prev).forEach(([chartTrackId, entry]) => {
                if (!entry.taskId) return;
                const relatedTask = tasks.find((task) => task.id === entry.taskId);
                if (!relatedTask) return;

                if (relatedTask.status === 'completed' && relatedTask.libraryTrackId) {
                    if (!completedTaskNotifiedRef.current[relatedTask.id]) {
                        completedTaskNotifiedRef.current[relatedTask.id] = true;
                        playTrack({
                            id: relatedTask.libraryTrackId,
                            title: entry.track.name,
                            artist: entry.track.artists.join(' / '),
                            album: entry.track.album || '',
                            duration: entry.track.duration,
                            album_id: relatedTask.libraryAlbumId || undefined
                        });
                        toast.success('下载完成，开始播放');
                    }
                    delete nextQueue[chartTrackId];
                    delete completedTaskNotifiedRef.current[relatedTask.id];
                    updated = true;
                } else if (relatedTask.status === 'failed') {
                    if (!failedTaskNotifiedRef.current[relatedTask.id]) {
                        failedTaskNotifiedRef.current[relatedTask.id] = true;
                        toast.error('下载失败，无法播放');
                    }
                    delete nextQueue[chartTrackId];
                    delete failedTaskNotifiedRef.current[relatedTask.id];
                    updated = true;
                }
            });

            return updated ? nextQueue : prev;
        });
    }, [tasks, playTrack]);

    return (
        <div className="space-y-10 pb-10 animate-in fade-in duration-700">
            {/* Hero Section */}
            <div className="relative -mx-6 -mt-6 px-8 py-12 mb-8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background z-0" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

                <div className="relative z-10 flex flex-col gap-1">
                    <h1 className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                        {greeting}
                    </h1>
                    <p className="text-lg text-muted-foreground/80 max-w-2xl">
                        Welcome back to your personal Music Hub. Your collection is ready.
                    </p>
                </div>

                {/* Quick Stats Strip */}
                <div className="relative z-10 mt-8 flex flex-wrap gap-4">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 shadow-sm">
                        <Library className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{stats.totalAlbums} Albums</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 shadow-sm">
                        <ListMusic className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">{playlists.length} Playlists</span>
                    </div>
                    {activeTaskCount > 0 && (
                        <Link to="/downloads">
                            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 shadow-sm hover:bg-accent/50 transition-colors cursor-pointer">
                                <Download className="w-4 h-4 text-green-500 animate-bounce" />
                                <span className="text-sm font-medium">{activeTaskCount} Downloading</span>
                            </div>
                        </Link>
                    )}
                    {failedTaskCount > 0 && (
                        <Link to="/downloads">
                            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-red-500/10 backdrop-blur-sm border border-red-500/20 shadow-sm hover:bg-red-500/20 transition-colors cursor-pointer">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <span className="text-sm font-medium text-red-500">{failedTaskCount} Failed</span>
                            </div>
                        </Link>
                    )}
                </div>
            </div>

            {/* Official Charts Section */}
            <div className="space-y-6 px-2">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-primary" />
                            Trending Charts
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Real-time rankings from NetEase Cloud Music
                        </p>
                    </div>
                </div>

                {isLoadingCharts ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[...Array(3)].map((_, idx) => (
                            <div key={idx} className="h-[400px] rounded-3xl bg-muted/30 animate-pulse" />
                        ))}
                    </div>
                ) : displayCharts.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {displayCharts.map((chart) => {
                            const tracks = chart.tracks.slice(0, 5); // Show top 5
                            const visual = getChartVisual(chart.key);
                            const Icon = visual.icon;

                            return (
                                <div
                                    key={chart.key}
                                    className="group relative overflow-hidden rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                >
                                    {/* Dynamic Background Gradient */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${visual.bgGradient} opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />

                                    <div className="relative p-6 flex flex-col h-full">
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2.5 rounded-2xl bg-background/80 shadow-sm ring-1 ring-black/5 ${visual.color}`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg leading-none mb-1">{chart.name}</h3>
                                                    <p className="text-xs text-muted-foreground font-medium">
                                                        {formatUpdateTime(chart.updateTime)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-xs font-medium px-2 py-1 rounded-full bg-background/50 text-muted-foreground">
                                                {formatPlayCount(chart.playCount)} plays
                                            </div>
                                        </div>

                                        {/* Tracks List */}
                                        <div className="flex-1 space-y-1">
                                            {tracks.map((track, index) => {
                                                const isPreparing = Boolean(autoPlayQueue[track.id]);
                                                const isTop3 = index < 3;
                                                const rankColor = index === 0 ? 'text-yellow-500' :
                                                    index === 1 ? 'text-slate-400' :
                                                        index === 2 ? 'text-amber-700' : 'text-muted-foreground';

                                                return (
                                                    <div
                                                        key={track.id}
                                                        className={`group/track flex items-center gap-3 p-2 rounded-xl transition-colors ${isPreparing ? 'cursor-wait bg-background/40' : 'hover:bg-background/60 cursor-pointer'}`}
                                                        onClick={() => handlePlayChartTrack(track)}
                                                    >
                                                        <span className={`w-4 text-center font-bold text-sm ${rankColor} ${isTop3 ? 'scale-110' : ''}`}>
                                                            {index + 1}
                                                        </span>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm truncate group-hover/track:text-primary transition-colors">
                                                                {track.name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {track.artists.join(' / ')}
                                                            </div>
                                                        </div>

                                                        {isPreparing ? (
                                                            <div className="h-8 w-8 flex items-center justify-center text-primary">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 opacity-0 group-hover/track:opacity-100 transition-opacity"
                                                                onClick={(e) => handleDownloadChartTrack(e, track)}
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Footer Action */}
                                        <div className="mt-4 pt-4 border-t border-border/10 flex justify-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full text-muted-foreground hover:text-primary hover:bg-primary/5 group-hover:bg-background/50"
                                                onClick={() => playPlaylist(chart.tracks.map(t => ({
                                                    id: t.id,
                                                    title: t.name,
                                                    artist: t.artists.join(' / '),
                                                    album: t.album,
                                                    cover: t.coverImgUrl || '',
                                                    duration: t.duration,
                                                    source: t.source
                                                })))} // Play all
                                            >
                                                <Play className="w-4 h-4 mr-2 fill-current" /> Play Top 100
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-3xl border border-dashed p-12 text-center text-muted-foreground bg-muted/30">
                        暂无榜单数据，请稍后再试。
                    </div>
                )}
            </div>

            {/* Recently Added Albums */}
            <div className="space-y-6 px-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Clock className="w-6 h-6 text-primary" />
                        Fresh Arrivals
                    </h2>
                    <Link to="/library">
                        <Button variant="ghost" className="group">
                            View Library <ChevronRight className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                    </Link>
                </div>

                {isLoadingAlbums ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="aspect-square rounded-2xl bg-muted/50 animate-pulse" />
                        ))}
                    </div>
                ) : recentAlbums.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {recentAlbums.map((album) => (
                            <div key={album.id} className="group space-y-3 cursor-pointer">
                                <div
                                    className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-lg transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2"
                                    onClick={() => handlePlayAlbum(album.id)}
                                >
                                    {album.cover_path ? (
                                        <img
                                            src={api.getCoverUrl('album', album.id)}
                                            alt={album.name}
                                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-muted">
                                            <Music className="h-12 w-12 text-muted-foreground/50" />
                                        </div>
                                    )}

                                    {/* Glassmorphic Play Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 backdrop-blur-[2px]">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-xl transition-transform duration-300 hover:scale-110">
                                            <Play className="ml-1 h-7 w-7 text-white" fill="currentColor" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1 px-1">
                                    <h3 className="font-semibold leading-none truncate text-base group-hover:text-primary transition-colors">
                                        {album.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground truncate">{album.artist}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-16 text-center rounded-3xl border border-dashed bg-muted/30">
                        <Music className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
                        <p className="text-lg text-muted-foreground font-medium">No albums in your library yet.</p>
                        <Link to="/search" className="mt-6 inline-block">
                            <Button size="lg" className="rounded-full px-8">Discover Music</Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
