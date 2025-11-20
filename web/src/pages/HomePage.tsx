import { useMemo } from 'react';
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
    ChevronRight
} from 'lucide-react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';

export function HomePage() {
    const { playTrack, playPlaylist } = usePlayer();

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

    // 获取下载任务（用于显示活动任务概览）
    const { data: tasks = [] } = useQuery({
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold tracking-tight">{greeting}</h1>
                <p className="text-muted-foreground">
                    Welcome back to your Music Hub.
                </p>
            </div>

            {/* Stats / Status Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-primary/5 border-primary/10">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-full text-primary">
                            <Library className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Collection</p>
                            <p className="text-2xl font-bold">{stats.totalAlbums} Albums</p>
                        </div>
                    </CardContent>
                </Card>

                <Link to="/downloads">
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-full text-primary">
                                <Download className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Active Downloads</p>
                                <p className="text-2xl font-bold">{activeTaskCount}</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {failedTaskCount > 0 && (
                    <Link to="/downloads">
                        <Card className="bg-red-500/5 border-red-500/10 hover:bg-red-500/10 transition-colors cursor-pointer h-full">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Failed Tasks</p>
                                    <p className="text-2xl font-bold text-red-500">{failedTaskCount}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )}

                <Link to="/playlists">
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-full text-primary">
                                <ListMusic className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Playlists</p>
                                <p className="text-2xl font-bold">{playlists.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Recently Added Albums */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Clock className="w-6 h-6" /> Recently Added
                    </h2>
                    <Link to="/library">
                        <Button variant="ghost" className="text-muted-foreground hover:text-primary">
                            View All <ChevronRight className="ml-1 w-4 h-4" />
                        </Button>
                    </Link>
                </div>

                {isLoadingAlbums ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="aspect-square rounded-xl bg-muted/50 animate-pulse" />
                        ))}
                    </div>
                ) : recentAlbums.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {recentAlbums.map((album) => (
                            <div key={album.id} className="group space-y-3 cursor-pointer">
                                <div
                                    className="relative aspect-square overflow-hidden rounded-xl bg-muted shadow-md transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1"
                                    onClick={() => handlePlayAlbum(album.id)}
                                >
                                    {album.cover_path ? (
                                        <img
                                            src={api.getCoverUrl('album', album.id)}
                                            alt={album.name}
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-muted">
                                            <Music className="h-12 w-12 text-muted-foreground/50" />
                                        </div>
                                    )}

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform duration-300 hover:scale-110">
                                            <Play className="ml-1 h-6 w-6 text-white" fill="currentColor" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-medium leading-none truncate">{album.name}</h3>
                                    <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center rounded-xl border border-dashed bg-muted/30">
                        <Music className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
                        <p className="text-muted-foreground">No albums in your library yet.</p>
                        <Link to="/search" className="mt-4 inline-block">
                            <Button>Go to Search</Button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Playlists Preview */}
            {playlists.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <ListMusic className="w-6 h-6" /> Your Playlists
                        </h2>
                        <Link to="/playlists">
                            <Button variant="ghost" className="text-muted-foreground hover:text-primary">
                                View All <ChevronRight className="ml-1 w-4 h-4" />
                            </Button>
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {playlists.slice(0, 3).map(playlist => (
                            <Link key={playlist.id} to={`/playlists/${playlist.id}`}>
                                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors group">
                                    <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center group-hover:scale-105 transition-transform">
                                        <ListMusic className="w-8 h-8 text-muted-foreground/50" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{playlist.name}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Created {new Date(playlist.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
