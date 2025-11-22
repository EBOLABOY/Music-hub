import { useState, useEffect } from 'react';
import { X, SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, Repeat, Repeat1, Shuffle } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { LyricsView } from './LyricsView';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { useNavigate } from 'react-router-dom';

interface FullScreenPlayerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function FullScreenPlayer({ isOpen, onClose }: FullScreenPlayerProps) {
    const {
        currentTrack,
        isPlaying,
        togglePlayback,
        next,
        prev,
        seek,
        currentTime,
        duration,
        volume,
        setVolume,
        mode,
        toggleMode
    } = usePlayer();

    const [isMuted, setIsMuted] = useState(false);
    const [showLyrics, setShowLyrics] = useState(false);
    const navigate = useNavigate();

    // Handle escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !currentTrack) return null;

    const formatTime = (seconds: number) => {
        if (!isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        seek(parseFloat(e.target.value));
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
        if (isMuted) {
            setVolume(0.7);
        } else {
            setVolume(0);
        }
        setIsMuted(!isMuted);
    };

    const handleArtistClick = (artist: string) => {
        onClose();
        navigate(`/search?q=${encodeURIComponent(artist)}`);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
            {/* Dynamic Background with Gradient Overlay */}
            <div className="absolute inset-0 z-[-1] overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center blur-[100px] opacity-30 scale-125 dark:opacity-20 transition-all duration-1000"
                    style={{
                        backgroundImage: currentTrack.album_id ? `url(${api.getCoverUrl('album', currentTrack.album_id)})` : undefined
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
            </div>

            {/* Header */}
            <div className="flex-none flex items-center justify-between px-6 py-4 md:px-8 md:py-6 z-20">
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors relative z-10"
                    aria-label="Close player"
                >
                    <X className="w-6 h-6" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Now Playing</span>
                </div>
                <button
                    onClick={() => setShowLyrics(!showLyrics)}
                    className={cn(
                        "md:hidden p-2 rounded-full transition-colors relative z-10",
                        showLyrics ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Toggle lyrics"
                >
                    <span className="text-xs font-bold">LRC</span>
                </button>
                <div className="hidden md:block w-10" /> {/* Spacer for desktop */}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 px-6 pb-8 md:px-8 md:pb-12 max-w-7xl mx-auto w-full min-h-0 z-10">

                {/* Left Side: Album Art & Info */}
                <div className={cn(
                    "flex flex-col items-center justify-center w-full transition-all duration-500 min-h-0 md:w-[45%]",
                    showLyrics ? "hidden md:flex" : "flex"
                )}>
                    {/* Album Art Card */}
                    <div className="relative aspect-square w-full max-w-[min(280px,40vh)] md:max-w-[min(400px,50vh)] rounded-[2rem] shadow-2xl mb-6 md:mb-10 group ring-1 ring-border/10 flex-shrink-0">
                        <div className="absolute inset-0 rounded-[2rem] overflow-hidden bg-muted">
                            {currentTrack.album_id ? (
                                <img
                                    src={api.getCoverUrl('album', currentTrack.album_id)}
                                    alt={currentTrack.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-secondary">
                                    <span className="text-6xl">🎵</span>
                                </div>
                            )}
                        </div>
                        {/* Shine effect */}
                        <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    </div>

                    {/* Track Info */}
                    <div className="text-center space-y-1.5 mb-6 md:mb-8 w-full px-4 flex-shrink-0">
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
                            {currentTrack.title}
                        </h2>
                        <p
                            className="text-lg text-muted-foreground font-medium truncate hover:text-primary hover:underline cursor-pointer transition-colors"
                            onClick={() => handleArtistClick(currentTrack.artist)}
                        >
                            {currentTrack.artist}
                        </p>
                        {currentTrack.album && (
                            <p
                                className="text-sm text-muted-foreground/60 font-medium truncate hover:text-primary hover:underline cursor-pointer transition-colors"
                                onClick={() => {
                                    onClose();
                                    navigate(`/search?q=${encodeURIComponent(currentTrack.album || '')}`);
                                }}
                            >
                                {currentTrack.album}
                            </p>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full space-y-2 mb-6 md:mb-8 px-2 flex-shrink-0">
                        <div className="group relative h-1.5 w-full rounded-full bg-secondary cursor-pointer overflow-hidden">
                            <div
                                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-100"
                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                            />
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={handleSeek}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground tabular-nums">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-6 md:gap-10 mb-6 md:mb-8 flex-shrink-0">
                        <button
                            onClick={toggleMode}
                            className={cn(
                                "p-2 transition-colors",
                                mode === 'sequence' ? "text-muted-foreground hover:text-foreground" : "text-primary"
                            )}
                            title={mode === 'sequence' ? 'Sequence' : mode === 'loop' ? 'Loop One' : 'Shuffle'}
                        >
                            {mode === 'sequence' && <Repeat className="w-5 h-5" />}
                            {mode === 'loop' && <Repeat1 className="w-5 h-5" />}
                            {mode === 'shuffle' && <Shuffle className="w-5 h-5" />}
                        </button>

                        <button
                            onClick={prev}
                            className="p-2 text-foreground hover:scale-110 active:scale-95 transition-all"
                        >
                            <SkipBack className="w-8 h-8 fill-current" />
                        </button>

                        <button
                            onClick={togglePlayback}
                            className="p-4 rounded-full bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                        >
                            {isPlaying ? (
                                <Pause className="w-8 h-8 fill-current" />
                            ) : (
                                <Play className="w-8 h-8 fill-current ml-1" />
                            )}
                        </button>

                        <button
                            onClick={next}
                            className="p-2 text-foreground hover:scale-110 active:scale-95 transition-all"
                        >
                            <SkipForward className="w-8 h-8 fill-current" />
                        </button>

                        <div className="w-9" /> {/* Spacer to balance layout since we removed the right button */}
                    </div>

                    {/* Volume & Toggles */}
                    <div className="flex items-center gap-4 w-full max-w-xs justify-center flex-shrink-0">
                        <div className="flex items-center gap-3 flex-1 group">
                            <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground transition-colors">
                                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                            <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden relative">
                                <div
                                    className="absolute top-0 left-0 h-full bg-primary transition-colors"
                                    style={{ width: `${volume * 100}%` }}
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Lyrics */}
                <div className={cn(
                    "flex-col h-full w-full md:w-[55%] min-h-0 animate-in fade-in slide-in-from-right-8 duration-700 delay-100",
                    showLyrics ? "flex" : "hidden md:flex"
                )}>
                    <div className="h-full rounded-[2rem] bg-muted/30 backdrop-blur-md border border-border/5 overflow-hidden relative group">
                        <LyricsView
                            trackId={currentTrack.id}
                            currentTime={currentTime}
                            className="h-full py-8 px-8 text-lg md:text-xl"
                            activeClassName="text-primary scale-105 font-bold origin-left"
                            inactiveClassName="text-muted-foreground/60 hover:text-foreground/80 transition-colors"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
