import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
    Search as SearchIcon,
    Download,
    Loader2,
    Play,
    Plus,
    Music,
    Disc,
    Globe,
    Sparkles,
    Command,
    Waves,
    ChevronDown,
    Check
} from 'lucide-react';
import { api, type TrackInfo, type SearchSource } from '@/services/api';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { AddToPlaylistModal } from '@/components/AddToPlaylistModal';

// 定义存储 Key，方便管理
const STORAGE_KEY_QUERY = 'music_hub_search_query';
const STORAGE_KEY_SOURCE = 'music_hub_search_source';

export function SearchPage() {
    const [searchParams] = useSearchParams();
    const urlQuery = searchParams.get('q');

    // 1. 初始化状态时，优先从 URL 读取，其次从 sessionStorage 读取
    const [query, setQuery] = useState(() => {
        return urlQuery || sessionStorage.getItem(STORAGE_KEY_QUERY) || '';
    });

    // 注意：debouncedQuery 也要初始化
    const [debouncedQuery, setDebouncedQuery] = useState(() => {
        return urlQuery || sessionStorage.getItem(STORAGE_KEY_QUERY) || '';
    });

    const [source, setSource] = useState<SearchSource>(() => {
        return (sessionStorage.getItem(STORAGE_KEY_SOURCE) as SearchSource) || 'netease';
    });

    const [trackToAdd, setTrackToAdd] = useState<string | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [isSourceOpen, setIsSourceOpen] = useState(false);

    // 监听 URL 变化，如果 URL 变了（比如从外部跳转进来），更新搜索状态
    useEffect(() => {
        if (urlQuery && urlQuery !== query) {
            setQuery(urlQuery);
            setDebouncedQuery(urlQuery);
        }
    }, [urlQuery]);

    // 2. 监听 query 和 source 变化，实时写入 sessionStorage
    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY_QUERY, query);
    }, [query]);

    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY_SOURCE, source);
    }, [source]);

    // Debounce search logic
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    // 当切换源时，如果输入框有内容，应该立即触发新的搜索（更新 debouncedQuery 可以利用 React Query 的缓存机制）
    useEffect(() => {
        if (query) {
            setDebouncedQuery(query);
        }
    }, [source]);

    const {
        data: searchResponse,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['search', debouncedQuery, source],
        queryFn: ({ pageParam = 1 }) => api.search(debouncedQuery, source, pageParam as number),
        getNextPageParam: (lastPage, allPages) => {
            // Assuming if we get results, there might be more.
            // Ideally backend should return total pages, but for now we check if we got any results.
            return lastPage.results.length > 0 ? allPages.length + 1 : undefined;
        },
        initialPageParam: 1,
        enabled: debouncedQuery.length > 0,
        staleTime: 1000 * 60 * 5,
    });

    const results = searchResponse?.pages.flatMap(page => page.results) || [];

    const handleDownload = async (track: TrackInfo) => {
        try {
            const task = await api.startDownload({
                trackId: track.trackId || track.id || '',
                picId: track.picId || track.pic_id || '',
                source: track.source || source,
                title: track.title || track.name || 'Unknown Title',
                artist: Array.isArray(track.artist) ? track.artist.join(', ') : (track.artist || 'Unknown Artist'),
                album: track.album || track.album_name || ''
            });
            if (task.existing && task.libraryTrackId) {
                toast.success('该歌曲已在本地，无需重复下载');
            } else {
                toast.success('Added to download queue');
            }
        } catch (error) {
            toast.error('Failed to start download');
            throw error; // Re-throw for batch handling
        }
    };

    const handlePlay = (track: TrackInfo) => {
        toast('Playing feature coming soon', { icon: '🎵' });
    };

    const handleSearch = () => {
        setDebouncedQuery(query);
    };

    const handleArtistClick = (artist: string) => {
        setQuery(artist);
        // 如果当前是 qobuz_album，切回 qobuz 搜歌手
        if (source === 'qobuz_album') {
            setSource('qobuz');
        }
    };

    const handleAlbumClick = (album: string) => {
        setQuery(album);
        // 如果当前是 qobuz，切换到 qobuz_album 搜专辑
        if (source === 'qobuz') {
            setSource('qobuz_album');
        }
    };

    const getSourceName = (s: string) => {
        if (s === 'netease') return 'Netease';
        if (s === 'qobuz') return 'Qobuz';
        if (s === 'qobuz_album') return 'Qobuz Album';
        if (s === 'tidal') return 'Tidal';
        return s;
    };

    return (
        <div className="relative min-h-[80vh] flex flex-col items-center w-full max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Header Section */}
            <div className="text-center space-y-4 mt-8 md:mt-16 z-10">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-pink-500">
                    Discover Music
                </h1>
                <p className="text-muted-foreground text-lg max-w-lg mx-auto">
                    Search across {source === 'qobuz' || source === 'qobuz_album' ? 'Qobuz High-Res' : source === 'tidal' ? 'Tidal High-Fidelity' : 'Netease Cloud Music'} library
                </p>
            </div>

            {/* Optimized Search Bar */}
            <div className="w-full max-w-3xl relative group z-20">
                {/* Glow Effect behind search bar */}
                <div className={cn(
                    "absolute -inset-1 rounded-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 opacity-20 blur-xl transition-all duration-500",
                    isFocused ? "opacity-50 scale-105" : "group-hover:opacity-30"
                )} />

                <div className={cn(
                    "relative flex items-center p-2 bg-white/80 dark:bg-black/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-full transition-all duration-300",
                    isFocused && "ring-2 ring-primary/20 bg-white dark:bg-black"
                )}>

                    {/* Source Switcher (Dropdown) */}
                    <div className="relative shrink-0 mr-2">
                        <button
                            onClick={() => setIsSourceOpen(!isSourceOpen)}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-sm font-medium"
                        >
                            {source === 'netease' && <Globe className="w-4 h-4 text-primary" />}
                            {(source === 'qobuz' || source === 'qobuz_album') && <Disc className="w-4 h-4 text-blue-500" />}
                            {source === 'tidal' && <Waves className="w-4 h-4 text-cyan-500" />}
                            <span className="hidden sm:inline">
                                {getSourceName(source)}
                            </span>
                            <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", isSourceOpen && "rotate-180")} />
                        </button>

                        {/* Dropdown Menu */}
                        {isSourceOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsSourceOpen(false)}
                                />
                                <div className="absolute top-full left-0 mt-2 w-48 p-1 bg-white/90 dark:bg-black/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="space-y-1">
                                        {[
                                            { id: 'netease', name: 'Netease', icon: Globe, color: 'text-primary' },
                                            { id: 'qobuz', name: 'Qobuz', icon: Disc, color: 'text-blue-500' },
                                            { id: 'tidal', name: 'Tidal', icon: Waves, color: 'text-cyan-500' }
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    setSource(item.id as any);
                                                    setIsSourceOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors",
                                                    source === item.id
                                                        ? "bg-primary/10 text-foreground"
                                                        : "hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <item.icon className={cn("w-4 h-4", item.color)} />
                                                    <span>{item.name}</span>
                                                </div>
                                                {source === item.id && <Check className="w-3 h-3 text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Input Field */}
                    <div className="flex-1 flex items-center h-12 relative border-l border-border/50 pl-4">
                        <SearchIcon className={cn("w-5 h-5 transition-colors absolute", isFocused ? "text-primary" : "text-muted-foreground")} />
                        <input
                            type="text"
                            placeholder="Search songs, artists, albums..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className="w-full h-full bg-transparent border-none outline-none pl-8 pr-4 text-lg placeholder:text-muted-foreground/50 text-foreground"
                            autoFocus={!query} // 只有当没有查询词时才自动聚焦，避免切回来时键盘突然弹起（移动端）
                        />
                        <div className="hidden md:flex absolute right-2 items-center gap-1 pointer-events-none text-xs text-muted-foreground bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">
                            <Command className="w-3 h-3" />
                            <span>Enter</span>
                        </div>
                    </div>

                    {/* Search Button */}
                    <Button
                        onClick={handleSearch}
                        size="lg"
                        className="rounded-full h-12 px-8 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                    >
                        Search
                    </Button>
                </div>
            </div>

            {/* Results Area */}
            <div className="w-full z-10 pb-20">
                {isLoading && results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse">Searching the universe...</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <div className="flex justify-between items-center px-2">
                            <p className="text-muted-foreground text-sm">
                                Found {results.length} tracks
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={async () => {
                                    if (!confirm(`Are you sure you want to download all ${results.length} tracks?`)) return;

                                    toast.success(`Starting batch download for ${results.length} tracks...`);

                                    // Simple concurrency control
                                    const CONCURRENCY = 3;
                                    const queue = [...results];

                                    const processNext = async () => {
                                        if (queue.length === 0) return;
                                        const track = queue.shift();
                                        if (!track) return;

                                        try {
                                            await handleDownload(track);
                                        } catch (e) {
                                            console.error('Download failed for', track.title);
                                        } finally {
                                            await processNext();
                                        }
                                    };

                                    const workers = [];
                                    for (let i = 0; i < Math.min(CONCURRENCY, results.length); i++) {
                                        workers.push(processNext());
                                    }

                                    await Promise.all(workers);
                                    toast.success('Batch download requests submitted');
                                }}
                            >
                                <Download className="h-4 w-4" />
                                Download All
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {results.map((track, i) => (
                                <div
                                    key={track.id || i}
                                    className="group flex items-center gap-4 p-3 rounded-2xl bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
                                >
                                    {/* Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 pl-2">
                                        <h3 className="font-semibold text-base truncate text-foreground group-hover:text-primary transition-colors">
                                            {track.title || track.name}
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                                            <span
                                                className="truncate max-w-[200px] hover:text-primary hover:underline cursor-pointer transition-colors"
                                                onClick={() => handleArtistClick(Array.isArray(track.artist) ? track.artist[0] : track.artist || '')}
                                            >
                                                {Array.isArray(track.artist) ? track.artist.join(', ') : track.artist}
                                            </span>
                                            {(track.album || track.album_name) && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                                                    <span
                                                        className="truncate max-w-[200px] opacity-80 hover:opacity-100 hover:text-primary hover:underline cursor-pointer transition-all"
                                                        onClick={() => handleAlbumClick(track.album || track.album_name || '')}
                                                    >
                                                        {track.album || track.album_name}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 pr-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                            onClick={() => handlePlay(track)}
                                            title="Play"
                                        >
                                            <Play className="h-5 w-5 fill-current" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                            onClick={() => setTrackToAdd(track.id || track.trackId || '')}
                                            title="Add to Playlist"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="rounded-full gap-2 shadow-sm hover:shadow-md transition-all bg-white/50 dark:bg-white/10 hover:bg-primary hover:text-primary-foreground border border-white/10"
                                            onClick={() => handleDownload(track)}
                                        >
                                            <Download className="h-4 w-4" />
                                            <span className="hidden sm:inline">Download</span>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Load More Button */}
                        {hasNextPage && (
                            <div className="flex justify-center pt-8 pb-4">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    className="min-w-[200px] rounded-full"
                                >
                                    {isFetchingNextPage ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading more...
                                        </>
                                    ) : (
                                        'Load More Results'
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : debouncedQuery ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="h-20 w-20 bg-muted/30 rounded-full flex items-center justify-center">
                            <SearchIcon className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <div>
                            <p className="text-xl font-semibold">No results found</p>
                            <p className="text-muted-foreground">Try adjusting your search terms</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 opacity-50">
                        <div className="relative">
                            <Sparkles className="absolute -top-6 -right-6 h-8 w-8 text-yellow-500 animate-bounce" />
                            <Music className="h-24 w-24 text-muted-foreground/30" />
                        </div>
                        <h2 className="text-2xl font-semibold">Ready to explore?</h2>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                            <span className="bg-muted/50 px-3 py-1 rounded-full">🎵 Song Name</span>
                            <span className="bg-muted/50 px-3 py-1 rounded-full">👤 Artist</span>
                            <span className="bg-muted/50 px-3 py-1 rounded-full">💿 Album</span>
                        </div>
                    </div>
                )}
            </div>

            {trackToAdd && (
                <AddToPlaylistModal
                    onClose={() => setTrackToAdd(null)}
                    trackId={trackToAdd}
                />
            )}
        </div>
    );
}