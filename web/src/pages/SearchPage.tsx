import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
    Command
} from 'lucide-react';
import { api, type TrackInfo } from '@/services/api';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { AddToPlaylistModal } from '@/components/AddToPlaylistModal';

// 定义存储 Key，方便管理
const STORAGE_KEY_QUERY = 'music_hub_search_query';
const STORAGE_KEY_SOURCE = 'music_hub_search_source';

export function SearchPage() {
    // 1. 初始化状态时，优先从 sessionStorage 读取
    const [query, setQuery] = useState(() => {
        return sessionStorage.getItem(STORAGE_KEY_QUERY) || '';
    });
    
    // 注意：debouncedQuery 也要初始化，否则进入页面虽然有文字，但不会触发搜索
    const [debouncedQuery, setDebouncedQuery] = useState(() => {
        return sessionStorage.getItem(STORAGE_KEY_QUERY) || '';
    });

    const [source, setSource] = useState<'qobuz' | 'netease'>(() => {
        return (sessionStorage.getItem(STORAGE_KEY_SOURCE) as 'qobuz' | 'netease') || 'netease';
    });

    const [trackToAdd, setTrackToAdd] = useState<string | null>(null);
    const [isFocused, setIsFocused] = useState(false);

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

    const { data: searchResponse, isLoading } = useQuery({
        queryKey: ['search', debouncedQuery, source],
        queryFn: () => api.search(debouncedQuery, source),
        // 只有当 debouncedQuery 有值时才请求
        enabled: debouncedQuery.length > 0,
        // 设置缓存时间，让体验更丝滑，从其他页面切回来如果是相同搜索词，直接显示结果
        staleTime: 1000 * 60 * 5, // 5分钟内不视为过期
    });

    const results = searchResponse?.results || [];

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
        }
    };

    const handlePlay = (track: TrackInfo) => {
        toast('Playing feature coming soon', { icon: '🎵' });
    };

    const handleSearch = () => {
        setDebouncedQuery(query);
    };

    return (
        <div className="relative min-h-[80vh] flex flex-col items-center w-full max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Header Section */}
            <div className="text-center space-y-4 mt-8 md:mt-16 z-10">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-pink-500">
                    Discover Music
                </h1>
                <p className="text-muted-foreground text-lg max-w-lg mx-auto">
                    Search across {source === 'qobuz' ? 'Qobuz High-Res' : 'Netease Cloud Music'} library
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
                    
                    {/* Source Switcher (Integrated) */}
                    <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-full mr-2 shrink-0">
                        <button
                            onClick={() => setSource('netease')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                                source === 'netease' 
                                    ? "bg-white dark:bg-gray-800 text-primary shadow-sm" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                            )}
                        >
                            <Globe className="w-4 h-4" />
                            <span className="hidden sm:inline">Netease</span>
                        </button>
                        <button
                            onClick={() => setSource('qobuz')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                                source === 'qobuz' 
                                    ? "bg-white dark:bg-gray-800 text-blue-500 shadow-sm" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                            )}
                        >
                            <Disc className="w-4 h-4" />
                            <span className="hidden sm:inline">Qobuz</span>
                        </button>
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
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse">Searching the universe...</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="rounded-3xl border border-white/20 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-white/10 bg-black/5 dark:bg-white/5 text-muted-foreground backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 font-medium w-16">#</th>
                                    <th className="px-6 py-4 font-medium">Track</th>
                                    <th className="px-6 py-4 font-medium hidden md:table-cell">Artist</th>
                                    <th className="px-6 py-4 font-medium hidden lg:table-cell">Album</th>
                                    <th className="px-6 py-4 font-medium w-[120px] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {results.map((track, i) => (
                                    <tr
                                        key={track.id || i}
                                        className="group transition-colors hover:bg-primary/5 dark:hover:bg-white/5"
                                    >
                                        <td className="px-6 py-4 text-muted-foreground font-medium">
                                            <div className="relative w-8 flex items-center justify-center">
                                                <span className="group-hover:opacity-0 transition-opacity">{i + 1}</span>
                                                <button
                                                    onClick={() => handlePlay(track)}
                                                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all text-primary"
                                                >
                                                    <Play className="h-5 w-5 fill-current" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm group-hover:shadow-md transition-shadow relative">
                                                    {(track as any).cover || (track as any).pic_id ? (
                                                        <img
                                                            src={(track as any).cover || api.getCoverUrl('track', (track as any).pic_id)}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                                                            <Music className="h-5 w-5 text-muted-foreground/50" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-base truncate max-w-[200px] sm:max-w-[300px] text-foreground group-hover:text-primary transition-colors">
                                                        {track.title || track.name}
                                                    </span>
                                                    <span className="md:hidden text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {Array.isArray(track.artist) ? track.artist.join(', ') : track.artist}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground hidden md:table-cell truncate max-w-[200px]">
                                            {Array.isArray(track.artist) ? track.artist.join(', ') : track.artist}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground hidden lg:table-cell truncate max-w-[200px]">
                                            {track.album || track.album_name || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 transform translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary"
                                                    onClick={() => setTrackToAdd(track.id || track.trackId || '')}
                                                    title="Add to Playlist"
                                                >
                                                    <Plus className="h-5 w-5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary"
                                                    onClick={() => handleDownload(track)}
                                                    title="Download"
                                                >
                                                    <Download className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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