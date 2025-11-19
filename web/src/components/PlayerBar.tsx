import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { api, type MediaTrack } from '@/services/api';

interface PlayerBarProps {
  track: MediaTrack | null;
  onNext?: () => void;
  onPrev?: () => void;
  albumCoverUrl?: string;
}

export function PlayerBar({ track, onNext, onPrev, albumCoverUrl }: PlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (track && audioRef.current) {
      audioRef.current.src = api.getStreamUrl(track.id);
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((error) => console.warn('Autoplay prevented', error));
      setCurrentTime(0);
      setDuration(track.duration || 0);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [track]);

  const togglePlay = () => {
    if (!audioRef.current || !track) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch((error) => console.warn('Play failed', error));
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    if (!duration && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!audioRef.current || Number.isNaN(value)) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) return;
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value;
      audioRef.current.muted = value === 0;
    }
    setIsMuted(value === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      audioRef.current.volume = 0.5;
    }
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const displayDuration = track?.duration || duration;

  if (!track) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-20 items-center justify-between border-t border-gray-200 bg-white/90 px-4 text-gray-900 shadow-2xl backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/90 dark:text-gray-100">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onEnded={onNext}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || duration)}
      />

      <div className="flex min-w-0 w-1/3 items-center gap-3">
        {albumCoverUrl ? (
          <img
            src={albumCoverUrl}
            alt="Cover"
            className="h-12 w-12 rounded-md object-cover shadow-sm"
            loading="lazy"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-200 text-xs text-gray-500 dark:bg-gray-800">
            No Cover
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{track.title}</div>
          <div className="truncate text-xs text-gray-500 dark:text-gray-400">{track.artist}</div>
        </div>
      </div>

      <div className="flex w-1/3 flex-col items-center">
        <div className="mb-1 flex items-center gap-4">
          <button
            type="button"
            onClick={onPrev}
            className="text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition hover:bg-blue-700"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>
        <div className="flex w-full max-w-md items-center gap-2">
          <span className="w-8 text-right text-[10px] font-mono text-gray-500">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={displayDuration || 1}
            value={currentTime}
            onChange={handleSeek}
            className="h-1 flex-1 cursor-pointer appearance-none rounded bg-gray-200 dark:bg-gray-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600"
          />
          <span className="w-8 text-[10px] font-mono text-gray-500">
            {formatTime(displayDuration)}
          </span>
        </div>
      </div>

      <div className="flex w-1/3 items-center justify-end gap-3">
        <button
          type="button"
          onClick={toggleMute}
          className="text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="h-1 w-20 cursor-pointer appearance-none rounded bg-gray-200 dark:bg-gray-700 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-400"
        />
      </div>
    </div>
  );
}
