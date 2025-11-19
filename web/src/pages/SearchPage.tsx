import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, Download, Loader2, Play, Plus, Music } from 'lucide-react';
import { api, type TrackInfo } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { AddToPlaylistModal } from '@/components/AddToPlaylistModal';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [source, setSource] = useState<'qobuz' | 'netease'>('qobuz');
  const [trackToAdd, setTrackToAdd] = useState<string | null>(null);

  // Debounce search
  useState(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  });

  const { data: searchResponse, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, source],
    queryFn: () => api.search(debouncedQuery, source),
    enabled: debouncedQuery.length > 0
  });

  const results = searchResponse?.results || [];

  const handleDownload = async (track: TrackInfo) => {
    try {
      await api.startDownload({
        trackId: track.trackId || track.id || '',
        picId: track.picId || track.pic_id || '',
        source: track.source || source,
        title: track.title || track.name || 'Unknown Title',
        artist: Array.isArray(track.artist) ? track.artist.join(', ') : (track.artist || 'Unknown Artist'),
        album: track.album || track.album_name || ''
      });
      toast.success('Added to download queue');
    } catch (error) {
      toast.error('Failed to start download');
    }
  };

  const handlePlay = (track: TrackInfo) => {
    // TODO: Implement play functionality properly with a context or global player
    // For now, we can try to stream if we have an ID, but usually we need a full track object for the player
    // This is a placeholder for the "Play" button action
    toast('Playing feature coming soon', { icon: '🎵' });
  };

  const handleSearch = () => {
    setDebouncedQuery(query);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Search</h1>
          <p className="text-muted-foreground">Find your favorite music from {source === 'qobuz' ? 'Qobuz' : '网易云音乐'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative min-w-[140px]">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as 'qobuz' | 'netease')}
            className="h-12 w-full appearance-none rounded-xl border-0 bg-white/50 pl-4 pr-10 text-sm font-medium shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:bg-white/10"
          >
            <option value="qobuz">Qobuz</option>
            <option value="netease">网易云音乐</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search songs, artists, albums..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="h-12 pl-9 rounded-xl border-0 bg-white/50 backdrop-blur-sm dark:bg-white/5"
            />
          </div>
          <Button onClick={handleSearch} className="h-12 rounded-xl px-6">Search</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : results.length > 0 ? (
        <div className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium w-12">#</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Artist</th>
                <th className="px-4 py-3 font-medium">Album</th>
                <th className="px-4 py-3 font-medium w-[100px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((track, i) => (
                <tr
                  key={track.id || i}
                  className="group border-b border-muted/50 transition-colors hover:bg-muted/50 last:border-0"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="group-hover:hidden">{i + 1}</span>
                    <button
                      onClick={() => handlePlay(track)}
                      className="hidden group-hover:inline-flex items-center justify-center text-primary"
                    >
                      <Play className="h-4 w-4" fill="currentColor" />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-muted">
                        {/* Handle different cover property names from different sources if needed */}
                        {(track as any).cover || (track as any).pic_id ? (
                          <img
                            src={(track as any).cover || api.getCoverUrl('track', (track as any).pic_id)}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Music className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <span className="font-medium truncate max-w-[200px] sm:max-w-[300px]">
                        {track.title || track.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]">
                    {Array.isArray(track.artist) ? track.artist.join(', ') : track.artist}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]">
                    {track.album || track.album_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setTrackToAdd(track.id || track.trackId || '')}
                        title="Add to Playlist"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(track)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : debouncedQuery ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <SearchIcon className="mb-4 h-12 w-12 opacity-20" />
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm">Try searching for something else</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center text-muted-foreground">
          <Music className="mb-6 h-16 w-16 opacity-10" />
          <h2 className="text-xl font-semibold">Start Searching</h2>
          <p className="mt-2 max-w-sm text-sm">
            Search for songs, albums, and artists from Qobuz and Netease Cloud Music.
          </p>
        </div>
      )}

      {trackToAdd && (
        <AddToPlaylistModal
          onClose={() => setTrackToAdd(null)}
          trackId={trackToAdd}
        />
      )}
    </div>
  );
}
