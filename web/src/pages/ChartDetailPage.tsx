import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, ArrowLeft, Download, Loader2, Plus, Music } from 'lucide-react';
import { api, type ChartTrack } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { usePlayer } from '@/contexts/PlayerContext';
import { AddToPlaylistModal } from '@/components/AddToPlaylistModal';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export function ChartDetailPage() {
    const { key } = useParams<{ key: string }>();
    const navigate = useNavigate();
    const { playTrack, playPlaylist } = usePlayer();
    const [trackToAdd, setTrackToAdd] = useState<string | null>(null);

    const { data: chart, isLoading } = useQuery({
        queryKey: ['chart', key],
        queryFn: () => api.getChart(key!, 100),
        enabled: !!key
    });

    const normalizeTrack = (track: ChartTrack) => ({
        id: track.id,
        title: track.name,
        artist: track.artists.join(' / '),
        album: track.album,
        album_id: track.albumId || undefined,
        duration: track.duration,
        cover: track.coverImgUrl || undefined,
        source: track.source
    });

    const handlePlayTrack = (track: ChartTrack) => {
        playTrack(normalizeTrack(track));
    };

    const handlePlayAll = () => {
        if (!chart?.tracks || chart.tracks.length === 0) {
            toast.error('This chart is empty');
            return;
        }
        playPlaylist(chart.tracks.map(normalizeTrack));
    };

    const handleDownloadTrack = async (e: React.MouseEvent, track: ChartTrack) => {
        e.stopPropagation();
        try {
            await api.startDownload({
                trackId: track.id,
                picId: track.picId || track.id,
                source: track.source || 'netease',
                title: track.name,
                artist: track.artists.join(' / ') || 'Unknown Artist',
                album: track.album || ''
            });
            toast.success('Added to download queue');
        } catch (error) {
            console.error('Download failed', error);
            toast.error('Failed to add to download queue');
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    if (!chart) {
        return <div className="text-center py-20">Chart not found</div>;
    }

    return (
        <div className="relative w-full max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 pl-0 hover:bg-transparent hover:text-primary">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-end">
                <div className="h-64 w-64 flex-shrink-0 overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10 group relative">
                    {chart.coverImgUrl ? (
                        <img src={chart.coverImgUrl} alt={chart.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                            <Music className="h-24 w-24 text-primary/40" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <Button size="icon" className="rounded-full h-16 w-16 bg-primary text-primary-foreground hover:scale-105 transition-transform shadow-xl" onClick={handlePlayAll}>
                            <Play className="h-8 w-8 ml-1" fill="currentColor" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 space-y-4 text-center md:text-left">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                            {chart.name}
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl">{chart.description}</p>
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground/80">
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                            {chart.tracks?.length || 0} songs
                        </span>
                        <span>
                            Updated {chart.updateTime ? new Date(chart.updateTime).toLocaleDateString() : 'Recently'}
                        </span>
                    </div>
                    <div className="flex gap-3 pt-2 justify-center md:justify-start">
                        <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20 hover:scale-105 transition-transform" onClick={handlePlayAll}>
                            <Play className="mr-2 h-5 w-5" fill="currentColor" />
                            Play All
                        </Button>
                    </div>
                </div>
            </div>

            {/* Track List */}
            <div className="space-y-2">
                {chart.tracks?.map((track, i) => (
                    <div
                        key={track.id}
                        className="group flex items-center gap-4 p-3 rounded-2xl bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-300 hover:shadow-lg hover:scale-[1.01] cursor-pointer"
                        onClick={() => handlePlayTrack(track)}
                    >
                        <div className="w-8 text-center font-bold text-muted-foreground/50 group-hover:text-primary transition-colors">
                            {i + 1}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                            <h3 className="font-semibold text-base truncate text-foreground group-hover:text-primary transition-colors">
                                {track.name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                                <span className="truncate max-w-[200px]">
                                    {track.artists.join(' / ')}
                                </span>
                                {track.album && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                                        <span className="truncate max-w-[200px] opacity-80">
                                            {track.album}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayTrack(track);
                                }}
                                title="Play"
                            >
                                <Play className="h-5 w-5 fill-current" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setTrackToAdd(track.id);
                                }}
                                title="Add to Playlist"
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="secondary"
                                size="icon"
                                className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors bg-transparent border-0 shadow-none"
                                onClick={(e) => handleDownloadTrack(e, track)}
                                title="Download"
                            >
                                <Download className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                ))}
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
