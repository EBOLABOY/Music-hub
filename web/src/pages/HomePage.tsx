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
    Loader2,
    Trophy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, type ChartTrack, type ChartWithMeta, type DownloadTask } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';

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

    // Data Fetching
    const { data: albums = [], isLoading: isLoadingAlbums } = useQuery({
        queryKey: ['albums'],
        queryFn: api.getAlbums
    });

    const { data: playlists = [] } = useQuery({
        queryKey: ['playlists'],
        queryFn: api.getPlaylists
    });

    const { data: neteaseCharts = [], isLoading: isLoadingCharts } = useQuery<ChartWithMeta[]>({
        queryKey: ['charts', 'netease'],
        queryFn: () => api.getCharts(20),
        staleTime: 1000 * 60 * 5
    });

    const { data: tasks = [] } = useQuery<DownloadTask[]>({
        queryKey: ['tasks'],
        queryFn: api.getTasks,
        refetchInterval: 5000
    });

    // Memoized Stats
    const {
        recentAlbums,
        stats,
        activeTaskCount,
        failedTaskCount
    } = useMemo(() => {
        const sortedAlbums = [...albums].sort((a, b) => {
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });

        const totalAlbums = albums.length;
        const active = tasks.filter(t => t.status !== 'completed' && t.status !== 'failed').length;
        const failed = tasks.filter(t => t.status === 'failed').length;

        return {
            recentAlbums: sortedAlbums.slice(0, 5),
            stats: { totalAlbums },
            activeTaskCount: active,
            failedTaskCount: failed
        };
    }, [albums, tasks]);

    // Visual Configurations
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
        },
        billboard: {
            icon: Trophy,
            color: 'text-fuchsia-500',
            gradient: 'from-fuchsia-400 to-pink-500',
            bgGradient: 'from-fuchsia-400/10 to-pink-500/5'
        }
    };

    const getChartVisual = (key: string) =>
        chartVisuals[key] || {
            icon: Music,
            color: 'text-primary',
            gradient: 'from-primary to-primary/50',
            bgGradient: 'from-primary/10 to-primary/5'
        };

    const displayCharts = useMemo(() => {
        return neteaseCharts.filter(chart => chartVisuals[chart.key]);
    }, [neteaseCharts]);

    // Logic Handlers
    const handlePlayAlbum = async (albumId: string) => {
        try {
            const detail = await api.getAlbumDetail(albumId);
            if (detail.tracks.length > 0) {
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
        if (diff < 1000 * 60 * 60 * 24) return '刚刚更新';
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
                toast.success('已在本地库中');
                return;
            }
            toast.success('已加入下载队列');
        } catch (error) {
            console.error('Download failed', error);
            toast.error('添加失败');
        }
    };

    const handlePlayChartTrack = async (track: ChartTrack) => {
        if (autoPlayQueue[track.id]) {
            toast('正在准备播放...');
            return;
        }
        setAutoPlayQueue((prev) => ({ ...prev, [track.id]: { taskId: null, track } }));

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
                toast.success('直接播放本地音乐');
                removeAutoPlayEntry(track.id);
                return;
            }
            setAutoPlayQueue((prev) => ({ ...prev, [track.id]: { taskId: task.id, track } }));
            toast.success('开始下载，完成后自动播放');
        } catch (error) {
            console.error('Auto download failed', error);
            toast.error('播放失败');
            removeAutoPlayEntry(track.id);
        }
    };

    // Watch tasks for auto-play
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
                        toast.success(`开始播放: ${entry.track.name}`);
                    }
                    delete nextQueue[chartTrackId];
                    delete completedTaskNotifiedRef.current[relatedTask.id];
                    updated = true;
                } else if (relatedTask.status === 'failed') {
                    if (!failedTaskNotifiedRef.current[relatedTask.id]) {
                        failedTaskNotifiedRef.current[relatedTask.id] = true;
                        toast.error(`下载失败: ${entry.track.name}`);
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
        <div className="relative w-full min-h-[80vh] space-y-10 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
            </div>

            {/* Hero Section */}
            <div className="relative space-y-6 pt-4 md:pt-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/80 to-foreground/40">
                        {greeting}
                    </h1>
                    <p className="text-xl text-muted-foreground/80 font-light max-w-2xl">
                        Your personal music sanctuary.
                    </p>
                </div>

                {/* Glass Stats Pills */}
                <div className="flex flex-wrap gap-3">
                    <Link to="/library" className="group">
                        <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300">
                            <div className="p-1.5 rounded-full bg-primary/10 text-primary">
                                <Library className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-medium">{stats.totalAlbums} Albums</span>
                        </div>
                    </Link>
                    
                    <Link to="/playlists" className="group">
                        <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300">
                             <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-500">
                                <ListMusic className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-medium">{playlists.length} Playlists</span>
                        </div>
                    </Link>

                    {(activeTaskCount > 0 || failedTaskCount > 0) && (
                        <Link to="/downloads" className="group">
                             <div className={cn(
                                 "flex items-center gap-3 px-5 py-2.5 rounded-full backdrop-blur-md border shadow-sm transition-all duration-300",
                                 failedTaskCount > 0 
                                    ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20"
                                    : "bg-white/50 dark:bg-white/5 border-white/20 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10"
                             )}>
                                {failedTaskCount > 0 ? (
                                    <AlertCircle className="w-4 h-4" />
                                ) : (
                                    <Download className="w-4 h-4 animate-bounce text-green-500" />
                                )}
                                <span className="text-sm font-medium">
                                    {failedTaskCount > 0 ? `${failedTaskCount} Failed` : `${activeTaskCount} Downloading`}
                                </span>
                            </div>
                        </Link>
                    )}
                </div>
            </div>

            {/* Trending Charts Section */}
            <div className="space-y-6">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
                            <TrendingUp className="w-6 h-6 text-primary" />
                            Trending Now
                        </h2>
                    </div>
                </div>

                {isLoadingCharts ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {[...Array(4)].map((_, idx) => (
                            <div key={idx} className="h-[400px] rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 animate-pulse" />
                        ))}
                    </div>
                ) : displayCharts.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {displayCharts.map((chart) => {
                            const tracks = chart.tracks.slice(0, 5);
                            const visual = getChartVisual(chart.key);
                            const Icon = visual.icon;

                            return (
                                <div
                                    key={chart.key}
                                    className="group relative overflow-hidden rounded-3xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1"
                                >
                                    {/* Subtle Gradient Overlay */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${visual.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

                                    <div className="relative p-6 flex flex-col h-full">
                                        {/* Chart Header */}
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "p-3 rounded-2xl shadow-inner bg-white/80 dark:bg-black/40 backdrop-blur-md ring-1 ring-inset ring-white/20",
                                                    visual.color
                                                )}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg leading-tight">{chart.name}</h3>
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                                                        {formatUpdateTime(chart.updateTime)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Track List */}
                                        <div className="flex-1 space-y-1">
                                            {tracks.map((track, index) => {
                                                const isPreparing = Boolean(autoPlayQueue[track.id]);
                                                const rankColor = index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-700' : 'text-muted-foreground/50';

                                                return (
                                                    <div
                                                        key={track.id}
                                                        className={cn(
                                                            "group/track flex items-center gap-3 p-2 rounded-xl transition-all duration-200",
                                                            isPreparing ? "bg-primary/10 cursor-wait" : "hover:bg-white/50 dark:hover:bg-white/10 cursor-pointer"
                                                        )}
                                                        onClick={() => handlePlayChartTrack(track)}
                                                    >
                                                        <span className={cn("w-4 text-center font-bold text-sm tabular-nums", rankColor)}>
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

                                                        <div className="flex items-center opacity-0 group-hover/track:opacity-100 transition-opacity">
                                                            {isPreparing ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                            ) : (
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary"
                                                                    onClick={(e) => handleDownloadChartTrack(e, track)}
                                                                >
                                                                    <Download className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Play All Action */}
                                        <div className="mt-4 pt-4 border-t border-white/10 dark:border-white/5">
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-center text-muted-foreground hover:text-primary hover:bg-primary/5"
                                                onClick={() => playPlaylist(chart.tracks.map(t => ({
                                                    id: t.id,
                                                    title: t.name,
                                                    artist: t.artists.join(' / '),
                                                    album: t.album,
                                                    cover: t.coverImgUrl || '',
                                                    duration: t.duration,
                                                    source: t.source
                                                })))}
                                            >
                                                <Play className="w-4 h-4 mr-2 fill-current" />
                                                Play Top 100
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-3xl border border-dashed border-white/20 p-12 text-center text-muted-foreground bg-white/5 backdrop-blur-sm">
                        暂无榜单数据
                    </div>
                )}
            </div>

            {/* Recent Albums Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-cyan-500">
                        <Clock className="w-6 h-6 text-blue-500" />
                        Fresh Arrivals
                    </h2>
                    <Link to="/library">
                        <Button variant="ghost" className="rounded-full hover:bg-white/10">
                            View Library <ChevronRight className="ml-1 w-4 h-4" />
                        </Button>
                    </Link>
                </div>

                {isLoadingAlbums ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="aspect-square rounded-2xl bg-white/5 animate-pulse" />
                        ))}
                    </div>
                ) : recentAlbums.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {recentAlbums.map((album) => (
                            <div key={album.id} className="group space-y-3 cursor-pointer">
                                <div
                                    className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-lg ring-1 ring-white/10 transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2 group-hover:ring-white/30"
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
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                            <Music className="h-12 w-12 text-white/20" />
                                        </div>
                                    )}
                                    
                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 backdrop-blur-[2px]">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-xl transition-transform duration-300 hover:scale-110">
                                            <Play className="ml-1 h-6 w-6 text-white" fill="currentColor" />
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
                    <div className="py-16 text-center rounded-3xl border border-dashed border-white/20 bg-white/5 backdrop-blur-sm">
                        <Music className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
                        <p className="text-lg text-muted-foreground font-medium">No albums in your library yet.</p>
                        <Link to="/search" className="mt-6 inline-block">
                            <Button className="rounded-full px-8 shadow-lg shadow-primary/20">Discover Music</Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
