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
            <div className="space-y-6">
                {lyrics.map((line, index) => (
                    <p
                        key={`${index}-${line.time}`}
                        data-lyric-index={index}
                        className={cn(
                            "transition-all duration-500 ease-out",
                            index === activeLineIndex
                                ? "scale-110 text-xl font-bold text-blue-600 dark:text-blue-400"
                                : "text-base text-gray-400 dark:text-gray-500 blur-[0.5px]"
                        )}
                    >
                        {line.text}
                    </p>
                ))}
            </div>
        </div>
    );
}
