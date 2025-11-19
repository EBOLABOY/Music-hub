import { useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, Mic2, Music } from 'lucide-react';
import { usePlayer, type Track } from '@/contexts/PlayerContext';
import { LyricsPanel } from './LyricsPanel';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

interface PlayerBarProps {
  track: Track | null;
  isPlaying: boolean;
}

export function PlayerBar({ track, isPlaying }: PlayerBarProps) {
  const { togglePlayback, next, prev, seek, setVolume, volume, currentTime, duration } = usePlayer();
  const [isMuted, setIsMuted] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

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

  // Always render, even when no track - show empty state
  return (
    <>
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Track Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
            {track?.album_id ? (
              <img
                src={api.getCoverUrl('album', track.album_id)}
                alt={track.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-6 h-6 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate text-sm">
              {track?.title || 'No track playing'}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {track?.artist || 'Select a track to play'}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
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
            onClick={() => track && setShowLyrics(!showLyrics)}
            disabled={!track}
            className={cn(
              "p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              showLyrics && "bg-primary/10 text-primary"
            )}
            title="Lyrics"
          >
            <Mic2 className="w-4 h-4" />
          </button>

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

      {/* Lyrics Panel */}
      {track && (
        <LyricsPanel
          trackId={track.id}
          trackTitle={track.title}
          trackArtist={track.artist}
          albumId={track.album_id}
          currentTime={currentTime}
          isOpen={showLyrics}
          onClose={() => setShowLyrics(false)}
        />
      )}
    </>
  );
}
