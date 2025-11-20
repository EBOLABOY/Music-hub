import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Music2 } from 'lucide-react';
import { api } from '@/services/api';
import { parseLrc, type LyricLine } from '@/lib/lrcParser';
import { cn } from '@/lib/utils';

interface LyricsViewProps {
    trackId: string;
    currentTime: number;
    className?: string;
}

export function LyricsView({ trackId, currentTime, className }: LyricsViewProps) {
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
        enabled: !!trackId
    });

    const lyrics = useMemo(() => (lyricsContent ? parseLrc(lyricsContent) : []), [lyricsContent]);

    useEffect(() => {
        if (!lyrics.length || !scrollRef.current) return;

        const nextActiveIndex = lyrics.findIndex((line, i) => {
            const nextLine = lyrics[i + 1];
            return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
        });

        if (nextActiveIndex === -1 || nextActiveIndex === activeLineIndex) {
            return;
        }

        setActiveLineIndex(nextActiveIndex);

        const container = scrollRef.current;
        const activeElement = container.querySelector<HTMLElement>(`[data-lyric-index="${nextActiveIndex}"]`);

        if (activeElement) {
            const containerHeight = container.clientHeight;
            const elementTop = activeElement.offsetTop;
            const elementHeight = activeElement.clientHeight;

            container.scrollTo({
                top: Math.max(elementTop - containerHeight / 2 + elementHeight / 2, 0),
                behavior: 'smooth'
            });
        }
    }, [currentTime, lyrics, activeLineIndex]);

    if (isLoading) {
        return (
            <div className={cn("flex h-full items-center justify-center", className)}>
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (isError || !lyrics.length) {
        return (
            <div className={cn("flex h-full flex-col items-center justify-center text-gray-500", className)}>
                <Music2 className="mb-2 h-12 w-12 opacity-20" />
                <p>No lyrics available</p>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className={cn(
                "h-full overflow-y-auto px-4 py-32 text-center scrollbar-hide mask-linear-fade",
                className
            )}
        >
            <div className="space-y-4 max-w-2xl mx-auto">
                {lyrics.map((line, index) => (
                    <div
                        key={`${index}-${line.time}`}
                        data-lyric-index={index}
                        className={cn(
                            "transition-all duration-500 ease-out px-4 py-2 rounded-lg border-l-4 border-transparent text-left",
                            index === activeLineIndex
                                ? "scale-105 text-lg font-semibold text-primary bg-primary/5 border-primary shadow-sm"
                                : "text-base text-gray-400 dark:text-gray-500"
                        )}
                    >
                        {line.text}
                    </div>
                ))}
            </div>
        </div>
    );
}
