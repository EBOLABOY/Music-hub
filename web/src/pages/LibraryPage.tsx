import { useQuery } from '@tanstack/react-query';
import { api, type MediaAlbum, type ScannerStatus, type MediaTrack } from '@/services/api';
import { Loader2, RefreshCw, Play, Music, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { AddToPlaylistModal } from '@/components/AddToPlaylistModal';
import { usePlayer } from '@/contexts/PlayerContext';
import toast from 'react-hot-toast';

export function LibraryPage() {
  const [selectedAlbum, setSelectedAlbum] = useState<MediaAlbum | null>(null);
  const [trackToAdd, setTrackToAdd] = useState<string | null>(null);
  const { playTrack } = usePlayer();

  const { data: status = { isScanning: false, logs: [] } } = useQuery<ScannerStatus>({
    queryKey: ['scannerStatus'],
    queryFn: api.getScannerStatus,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.isScanning ? 1000 : 5000;
    }
  });

  const { data: albums = [] } = useQuery<MediaAlbum[]>({
    queryKey: ['albums'],
    queryFn: api.getAlbums
  });

  const handleScan = async () => {
    try {
      await api.startScan();
      toast.success('Library scan started');
    } catch (error) {
      toast.error('Failed to start scan');
    }
  };

  const handlePlayTrack = (track: MediaTrack) => {
    playTrack({
      id: track.id,
      title: track.title,
      artist: track.artist,
      album_id: track.album_id,
      duration: track.duration
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Library</h1>
          <p className="mt-2 text-muted-foreground">
            {albums.length} albums
          </p>
        </div>
        <Button
          onClick={handleScan}
          disabled={status.isScanning}
          variant={status.isScanning ? "secondary" : "default"}
          className="gap-2"
        >
          {status.isScanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {status.isScanning ? 'Scanning...' : 'Scan Library'}
        </Button>
      </div>

      {selectedAlbum ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Button variant="ghost" onClick={() => setSelectedAlbum(null)} className="mb-6">
            ← Back to Albums
          </Button>

          <div className="flex flex-col gap-8 md:flex-row">
            <div className="flex-shrink-0">
              <div className="group relative h-64 w-64 overflow-hidden rounded-2xl shadow-2xl">
                {selectedAlbum.cover_path ? (
                  <img src={api.getCoverUrl('album', selectedAlbum.id)} alt={selectedAlbum.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-200 dark:bg-gray-800">
                    <Music className="h-24 w-24 opacity-20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <div>
                <h2 className="text-3xl font-bold">{selectedAlbum.name}</h2>
                <p className="text-xl text-primary">{selectedAlbum.artist}</p>
                <p className="text-sm text-muted-foreground">{selectedAlbum.year || 'Unknown Year'}</p>
              </div>

              <div className="space-y-1">
                <AlbumTracks albumId={selectedAlbum.id} onPlay={handlePlayTrack} onAddToPlaylist={setTrackToAdd} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {albums.map((album) => (
            <div
              key={album.id}
              className="group cursor-pointer space-y-3"
              onClick={() => setSelectedAlbum(album)}
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100 shadow-md transition-all duration-300 group-hover:shadow-xl dark:bg-gray-800">
                {album.cover_path ? (
                  <img
                    src={api.getCoverUrl('album', album.id)}
                    alt={album.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform duration-300 hover:scale-110">
                    <Play className="ml-1 h-6 w-6 text-white" fill="currentColor" />
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <h3 className="font-medium leading-none truncate">{album.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
              </div>
            </div>
          ))}
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

function AlbumTracks({ albumId, onPlay, onAddToPlaylist }: { albumId: string, onPlay: (track: MediaTrack) => void, onAddToPlaylist: (id: string) => void }) {
  const { data: albumDetail } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => api.getAlbum(albumId)
  });

  if (!albumDetail) return <div className="py-10 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium text-right">Duration</th>
            <th className="px-4 py-3 font-medium w-10"></th>
          </tr>
        </thead>
        <tbody>
          {albumDetail.tracks.map((track, i) => (
            <tr
              key={track.id}
              className="group border-b border-muted/50 transition-colors hover:bg-muted/50 last:border-0"
            >
              <td className="px-4 py-3 text-muted-foreground w-12">
                <span className="group-hover:hidden">{i + 1}</span>
                <button onClick={() => onPlay(track)} className="hidden group-hover:inline-block text-primary">
                  <Play className="h-4 w-4" fill="currentColor" />
                </button>
              </td>
              <td className="px-4 py-3 font-medium">{track.title}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
              </td>
              <td className="px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  onClick={() => onAddToPlaylist(track.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
