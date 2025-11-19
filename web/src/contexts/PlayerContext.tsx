import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';

export interface Track {
    id: string;
    title: string;
    artist: string;
    album?: string;
    album_id?: string;
    duration?: number;
}

interface PlayerContextType {
    // State
    currentTrack: Track | null;
    isPlaying: boolean;
    volume: number;
    currentTime: number;
    duration: number;
    queue: Track[];
    currentIndex: number;

    // Actions
    playTrack: (track: Track) => void;
    playPlaylist: (tracks: Track[], startIndex?: number) => void;
    pause: () => void;
    resume: () => void;
    next: () => void;
    prev: () => void;
    seek: (time: number) => void;
    setVolume: (level: number) => void;
    togglePlayback: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolumeState] = useState(0.7);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [queue, setQueue] = useState<Track[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        if (!audioRef.current || !currentTrack) return;

        if (isPlaying) {
            audioRef.current.play().catch(err => {
                console.error('Playback failed:', err);
                setIsPlaying(false);
            });
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying, currentTrack]);

    const playTrack = useCallback((track: Track) => {
        setCurrentTrack(track);
        setQueue([track]);
        setCurrentIndex(0);
        setIsPlaying(true);
    }, []);

    const playPlaylist = useCallback((tracks: Track[], startIndex: number = 0) => {
        if (tracks.length === 0) return;
        const track = tracks[startIndex];
        setCurrentTrack(track);
        setQueue(tracks);
        setCurrentIndex(startIndex);
        setIsPlaying(true);
    }, []);

    const next = useCallback(() => {
        if (currentIndex < queue.length - 1) {
            const nextIndex = currentIndex + 1;
            setCurrentTrack(queue[nextIndex]);
            setCurrentIndex(nextIndex);
            setIsPlaying(true);
        }
    }, [currentIndex, queue]);

    const prev = useCallback(() => {
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            setCurrentTrack(queue[prevIndex]);
            setCurrentIndex(prevIndex);
            setIsPlaying(true);
        }
    }, [currentIndex, queue]);

    const handleEnded = useCallback(() => {
        if (currentIndex < queue.length - 1) {
            next();
        } else {
            setIsPlaying(false);
        }
    }, [currentIndex, queue, next]);

    const pause = useCallback(() => setIsPlaying(false), []);
    const resume = useCallback(() => setIsPlaying(true), []);

    const togglePlayback = useCallback(() => {
        setIsPlaying(prevState => !prevState);
    }, []);

    const seek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    }, []);

    const updateVolume = useCallback((level: number) => {
        const newVolume = Math.max(0, Math.min(1, level));
        setVolumeState(newVolume);
    }, []);

    const value: PlayerContextType = {
        currentTrack,
        isPlaying,
        volume,
        currentTime,
        duration,
        queue,
        currentIndex,
        playTrack,
        playPlaylist,
        pause,
        resume,
        next,
        prev,
        seek,
        setVolume: updateVolume,
        togglePlayback
    };

    return (
        <PlayerContext.Provider value={value}>
            <audio
                ref={audioRef}
                src={currentTrack ? api.getStreamUrl(currentTrack.id) : undefined}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onDurationChange={(event) => setDuration(event.currentTarget.duration)}
                onEnded={handleEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    const context = useContext(PlayerContext);
    if (context === undefined) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
}
