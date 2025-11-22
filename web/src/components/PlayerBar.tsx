import { useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, Music, Maximize2, Repeat, Repeat1, Shuffle } from 'lucide-react';
import { usePlayer, type Track } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { useNavigate } from 'react-router-dom';

interface PlayerBarProps {
  track: Track | null;
  isPlaying: boolean;
  onOpenFullScreen?: () => void;
}

export function PlayerBar({ track, isPlaying, onOpenFullScreen }: PlayerBarProps) {
  const { togglePlayback, next, prev, seek, setVolume, volume, currentTime, duration, mode, toggleMode } = usePlayer();
  const [isMuted, setIsMuted] = useState(false);
  const navigate = useNavigate();

  const toggleMute = () => {
    if (isMuted) {
      setVolume(0.7);
    } else {
      setVolume(0);
    }
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seek(newTime);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleArtistClick = (e: React.MouseEvent, artist: string) => {
    e.stopPropagation();
    navigate(`/search?q=${encodeURIComponent(artist)}`);
  };

  // Always render, even when no track - show empty state
  return (
    <>
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Track Info */}
        <div
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
          onClick={() => track && onOpenFullScreen?.()}
        >
          <div
            className={cn(
              "w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden shadow-sm border border-gray-200/60 dark:border-white/10 relative",
              track?.album_id ? "bg-muted" : "bg-gradient-to-br from-primary/20 to-primary/40"
            )}
          >
            {track?.album_id ? (
              <>
                <img
                  src={api.getCoverUrl('album', track.album_id)}
                  alt={track.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-6 h-6 text-primary/60" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 group-hover:text-primary transition-colors">
            <div className="font-medium truncate text-sm">
              {track?.title || 'No track playing'}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              <span
                className="hover:text-primary hover:underline cursor-pointer transition-colors"
                onClick={(e) => track?.artist && handleArtistClick(e, track.artist)}
              >
                {track?.artist || 'Select a track to play'}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMode}
            className={cn(
              "p-2 rounded-full hover:bg-muted transition-colors",
              mode !== 'sequence' && "text-primary bg-primary/10"
            )}
            title={mode === 'sequence' ? 'Sequence' : mode === 'loop' ? 'Loop One' : 'Shuffle'}
          >
            {mode === 'sequence' && <Repeat className="w-4 h-4 text-muted-foreground" />}
            {mode === 'loop' && <Repeat1 className="w-4 h-4" />}
            {mode === 'shuffle' && <Shuffle className="w-4 h-4" />}
          </button>
          <button
            onClick={prev}
            disabled={!track}
            className="p-2 rounded-full hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Previous"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlayback}
            disabled={!track}
            className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="currentColor" />}
          </button>
          <button
            onClick={next}
            disabled={!track}
            className="p-2 rounded-full hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Next"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={!track}
            className={cn(
              "flex-1 h-1 rounded-full appearance-none bg-muted cursor-pointer",
              "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3",
              "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
              "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform",
              "[&::-webkit-slider-thumb]:hover:scale-110",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          <span className="text-xs text-muted-foreground tabular-nums w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume & Extras */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className={cn(
              "w-20 h-1 rounded-full appearance-none bg-muted cursor-pointer",
              "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3",
              "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
              "[&::-webkit-slider-thumb]:shadow-sm"
            )}
          />
        </div>
      </div>
    </>
  );
}
