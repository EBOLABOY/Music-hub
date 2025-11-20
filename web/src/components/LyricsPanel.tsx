import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Music2, X } from 'lucide-react';
import { api } from '@/services/api';
import { parseLrc, type LyricLine } from '@/lib/lrcParser';
import { cn } from '@/lib/utils';

interface LyricsPanelProps {
    trackId: string;
    trackTitle: string;
    trackArtist: string;
    albumId?: string;
    currentTime: number;
    isOpen: boolean;
    onClose: () => void;
}

export function LyricsPanel({
    trackId,
    trackTitle,
    trackArtist,
    albumId,
    currentTime,
    isOpen,
    onClose
}: LyricsPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeLineIndex, setActiveLineIndex] = useState(-1);

    const { data: lyricsContent, isLoading, isError } = useQuery({
        queryKey: ['lyrics', trackId],
        queryFn: async () => {
            const url = api.getLyricsUrl(trackId);
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch lyrics');
            return res.text();
        },
        enabled: !!trackId && isOpen
    });

    const lyrics = lyricsContent ? parseLrc(lyricsContent) : [];

    useEffect(() => {
        if (!lyrics.length) return;

        // Find the current active line
        const index = lyrics.findIndex((line, i) => {
            const nextLine = lyrics[i + 1];
            return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
        });

        if (index !== -1 && index !== activeLineIndex) {
            setActiveLineIndex(index);

            // Scroll to active line with smooth animation
            const container = scrollRef.current;
            const activeElement = container?.children[0]?.children[index] as HTMLElement;

            if (container && activeElement) {
                const containerHeight = container.clientHeight;
                const elementTop = activeElement.offsetTop;
                const elementHeight = activeElement.clientHeight;

                container.scrollTo({
                    top: elementTop - containerHeight / 3 + elementHeight / 2,
                    behavior: 'smooth'
                });
            }
        }
    }, [currentTime, lyrics, activeLineIndex]);

    return (
        <>
            {/* Backdrop for mobile */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 z-40 lg:hidden",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Lyrics Panel */}
            <div
                className={cn(
                    "fixed top-0 right-0 h-full w-full lg:w-[420px] bg-gradient-to-br from-gray-50/95 to-white/95 dark:from-gray-900/95 dark:to-black/95",
                    "backdrop-blur-2xl border-l border-gray-200/50 dark:border-white/20",
                    "shadow-2xl transform transition-transform duration-300 ease-out z-50",
                    "flex flex-col",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-5 border-b border-gray-200/50 dark:border-white/20">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Music2 className="w-5 h-5 text-primary" />
                            Lyrics
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-white/10 transition-colors"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Track Info */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/40 flex-shrink-0 overflow-hidden shadow-md">
                            {albumId ? (
                                <img
                                    src={api.getCoverUrl('album', albumId)}
                                    alt={trackTitle}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Music2 className="w-6 h-6 text-primary/50" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm truncate">{trackTitle}</h3>
                            <p className="text-xs text-muted-foreground truncate">{trackArtist}</p>
                        </div>
                    </div>
                </div>

                {/* Lyrics Content */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto scrollbar-hide px-6 py-8 relative mask-linear-fade"
                >
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                        </div>
                    ) : isError || !lyrics.length ? (
                        <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                            <Music2 className="mb-3 h-16 w-16 opacity-20" />
                            <p className="text-sm">No lyrics available</p>
                            <p className="text-xs mt-1 opacity-60">Try another track</p>
                        </div>
                    ) : (
                        <div className="space-y-4 min-h-full flex flex-col justify-center">
                            {lyrics.map((line, index) => (
                                <div
                                    key={`${index}-${line.time}`}
                                    className={cn(
                                        "transition-all duration-500 ease-out cursor-pointer px-4 py-2 rounded-lg border-l-4 border-transparent",
                                        index === activeLineIndex
                                            ? "scale-105 font-semibold text-foreground bg-primary/5 border-primary shadow-sm"
                                            : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30"
                                    )}
                                >
                                    {line.text}
                                </div>
                            ))}
                            {/* Bottom padding for better scroll experience */}
                            <div className="h-32" />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
