import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Play, Music, Plus, Search, ArrowLeft, Library as LibraryIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AddToPlaylistModal } from '@/components/AddToPlaylistModal';
import { api, type MediaAlbum, type MediaTrack, type ScannerStatus } from '@/services/api';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function LibraryPage() {
    const [selectedAlbum, setSelectedAlbum] = useState<MediaAlbum | null>(null);
    const [trackToAdd, setTrackToAdd] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { playTrack } = usePlayer();
    const navigate = useNavigate();

    const { data: status = { isScanning: false, logs: [] } } = useQuery<ScannerStatus>({
        queryKey: ['scannerStatus'],
        queryFn: api.getScannerStatus,
        refetchInterval: (query) => {
            const data = query.state.data;
            return data?.isScanning ? 1000 : 5000;
        }
    });

    const { data: albums = [], isLoading: isLoadingAlbums } = useQuery<MediaAlbum[]>({
        queryKey: ['albums'],
        queryFn: api.getAlbums
    });

    const filteredAlbums = useMemo(() => {
        if (!searchQuery) return albums;
        const lowerQ = searchQuery.toLowerCase();
        return albums.filter((album) => {
            return album.name.toLowerCase().includes(lowerQ) || album.artist.toLowerCase().includes(lowerQ);
        });
    }, [albums, searchQuery]);

    const handleScan = async () => {
        try {
            await api.startScan();
        } catch {
            // toast handled globally
        }
    };

    const handlePlayTrack = (track: MediaTrack) => {
        playTrack({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album_id: track.album_id,
            duration: track.duration
        });
    };

    const showEmptyState = !isLoadingAlbums && filteredAlbums.length === 0;

    return (
        <div className="relative min-h-[80vh] space-y-8 animate-in fade-in duration-500">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px] animate-[pulse_9s_ease-in-out_infinite]" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[130px] animate-[pulse_12s_ease-in-out_infinite]" />
            </div>

            {/* Header */}
            <div
                className={cn(
                    'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
                    'sticky top-[57px] md:top-0 z-20',
                    'py-4 -mx-4 px-4 md:mx-0 md:px-0',
                    'bg-background/80 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none',
                    'transition-all duration-200'
                )}
            >
                <div>
                    <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                        Library
                    </h1>
                    <p className="mt-2 text-muted-foreground font-light">{albums.length} albums collected</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72 group">
                        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition duration-500 blur" />
                        <div className="relative flex items-center bg-white/60 dark:bg-black/30 backdrop-blur-xl border border-white/10 rounded-xl shadow-sm">
                            <Search className="ml-3 h-4 w-4 text-muted-foreground" />
                            <input
                                placeholder="Filter albums..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 py-2.5 px-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                            />
                        </div>
                    </div>
                    <Button
                        onClick={handleScan}
                        disabled={status.isScanning}
                        variant="outline"
                        size="icon"
                        className={cn(
                            'border-white/10 bg-white/20 hover:bg-white/30 backdrop-blur-md transition',
                            status.isScanning && 'text-primary'
                        )}
                        title="Scan Library"
                    >
                        {status.isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {selectedAlbum ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Button
                        variant="ghost"
                        onClick={() => setSelectedAlbum(null)}
                        className="mb-6 pl-0 hover:pl-2 transition-all group text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Back to Albums
                    </Button>

                    <div className="rounded-3xl p-6 md:p-8 border border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-2xl">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-shrink-0 mx-auto md:mx-0">
                                <div className="group relative h-64 w-64 md:h-72 md:w-72 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15">
                                    {selectedAlbum.cover_path ? (
                                        <img
                                            src={api.getCoverUrl('album', selectedAlbum.id)}
                                            alt={selectedAlbum.name}
                                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-muted/40">
                                            <Music className="h-24 w-24 opacity-20" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                </div>
                            </div>

                            <div className="flex-1 space-y-6 min-w-0">
                                <div className="text-center md:text-left space-y-2">
                                    <h2
                                        className="text-3xl md:text-5xl font-bold tracking-tight truncate hover:text-primary hover:underline cursor-pointer transition-colors"
                                        onClick={() => {
                                            navigate(`/search?q=${encodeURIComponent(selectedAlbum.name)}`);
                                        }}
                                    >
                                        {selectedAlbum.name}
                                    </h2>
                                    <p
                                        className="text-xl md:text-2xl text-primary font-medium hover:underline cursor-pointer inline-block"
                                        onClick={() => {
                                            navigate(`/search?q=${encodeURIComponent(selectedAlbum.artist)}`);
                                        }}
                                    >
                                        {selectedAlbum.artist}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{selectedAlbum.year || 'Unknown Year'}</p>
                                </div>

                                <div className="rounded-xl bg-black/5 dark:bg-white/5 border border-white/5 overflow-hidden">
                                    <AlbumTracks albumId={selectedAlbum.id} onPlay={handlePlayTrack} onAddToPlaylist={setTrackToAdd} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {showEmptyState ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-in fade-in zoom-in duration-300">
                            {searchQuery ? (
                                <>
                                    <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                                        <Search className="h-10 w-10 opacity-20" />
                                    </div>
                                    <p>No albums found matching "{searchQuery}"</p>
                                </>
                            ) : (
                                <>
                                    <div className="h-24 w-24 rounded-full bg-muted/30 flex items-center justify-center mb-6 border border-white/10">
                                        <LibraryIcon className="h-10 w-10 opacity-20" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-foreground mb-2">Your library is empty</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs text-center mb-6">
                                        Scan your media folder or download music from the search page to get started.
                                    </p>
                                    <Button variant="outline" onClick={handleScan} disabled={status.isScanning}>
                                        {status.isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                        Scan Now
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 pb-20">
                            {isLoadingAlbums
                                ? Array.from({ length: 12 }).map((_, index) => (
                                    <div key={index} className="space-y-3 p-3 rounded-2xl">
                                        <div className="aspect-square rounded-xl bg-white/10 dark:bg-white/5 animate-pulse" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-3/4 rounded bg-white/10 dark:bg-white/5 animate-pulse" />
                                            <div className="h-3 w-1/2 rounded bg-white/10 dark:bg-white/5 animate-pulse" />
                                        </div>
                                    </div>
                                ))
                                : filteredAlbums.map((album) => (
                                    <div
                                        key={album.id}
                                        className="group cursor-pointer space-y-3 p-3 rounded-2xl hover:bg-white/30 dark:hover:bg-white/5 transition-all duration-300 hover:shadow-xl animate-in fade-in duration-500"
                                        onClick={() => setSelectedAlbum(album)}
                                    >
                                        <div className="relative aspect-square overflow-hidden rounded-xl bg-muted/50 shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-1">
                                            {album.cover_path ? (
                                                <img
                                                    src={api.getCoverUrl('album', album.id)}
                                                    alt={album.name}
                                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                    <Music className="h-12 w-12 text-muted-foreground/30" />
                                                </div>
                                            )}

                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100 backdrop-blur-[2px]">
                                                <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                                    <Play className="h-6 w-6 text-white ml-1" fill="currentColor" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <h3 className="font-semibold leading-tight truncate text-foreground/90 group-hover:text-primary transition-colors">
                                                {album.name}
                                            </h3>
                                            <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </>
            )}

            {trackToAdd && <AddToPlaylistModal onClose={() => setTrackToAdd(null)} trackId={trackToAdd} />}
        </div>
    );
}

function AlbumTracks({
    albumId,
    onPlay,
    onAddToPlaylist
}: {
    albumId: string;
    onPlay: (track: MediaTrack) => void;
    onAddToPlaylist: (id: string) => void;
}) {
    const { data: albumDetail } = useQuery({
        queryKey: ['album', albumId],
        queryFn: () => api.getAlbum(albumId)
    });

    if (!albumDetail) {
        return (
            <div className="py-10 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const formatDuration = (duration: number) => {
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60)
            .toString()
            .padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    return (
        <div className="w-full text-left text-sm">
            <div className="hidden md:flex border-b border-white/10 text-muted-foreground px-4 py-3 text-xs font-medium uppercase tracking-wider">
                <div className="w-10 text-center">#</div>
                <div className="flex-1">Title</div>
                <div className="w-20 text-right">Time</div>
                <div className="w-10" />
            </div>

            <div className="divide-y divide-white/5">
                {albumDetail.tracks.map((track, index) => (
                    <div key={track.id} className="group flex items-center px-4 py-3 hover:bg-primary/5 transition-colors">
                        <div className="w-8 md:w-10 text-center text-muted-foreground text-xs md:text-sm flex-shrink-0">
                            <span className="group-hover:hidden font-medium">{index + 1}</span>
                            <button
                                onClick={() => onPlay(track)}
                                className="hidden group-hover:inline-flex text-primary animate-in zoom-in duration-200"
                            >
                                <Play className="h-4 w-4 fill-current" />
                            </button>
                        </div>

                        <div className="flex-1 min-w-0 pr-4">
                            <div className="font-medium text-foreground/90 truncate">{track.title}</div>
                            <div className="md:hidden text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                <span>{formatDuration(track.duration)}</span>
                                <span>-</span>
                                <span>{track.format}</span>
                            </div>
                        </div>

                        <div className="hidden md:block w-20 text-right text-muted-foreground tabular-nums text-xs md:text-sm">
                            {formatDuration(track.duration)}
                        </div>

                        <div className="w-10 flex justify-end">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                onClick={() => onAddToPlaylist(track.id)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
