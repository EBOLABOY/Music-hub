import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Trash2, Clock, Music } from 'lucide-react';
import { api } from '@/services/api';
import type { PlaylistTrack } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Loader2 } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import toast from 'react-hot-toast';

export function PlaylistDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { playTrack, playPlaylist } = usePlayer();

    const { data: playlist, isLoading } = useQuery({
        queryKey: ['playlist', id],
        queryFn: () => api.getPlaylist(id!),
        enabled: !!id
    });

    const removeTrackMutation = useMutation({
        mutationFn: ({ playlistId, trackId }: { playlistId: string; trackId: string }) =>
            api.removeTrackFromPlaylist(playlistId, trackId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['playlist', id] });
            toast.success('Track removed');
        },
        onError: () => toast.error('Failed to remove track')
    });

    const deletePlaylistMutation = useMutation({
        mutationFn: api.deletePlaylist,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['playlists'] });
            toast.success('Playlist deleted');
            navigate('/playlists');
        },
        onError: () => toast.error('Failed to delete playlist')
    });

    const normalizeTrack = (track: PlaylistTrack) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: (track as any).album,
        album_id: track.album_id,
        duration: track.duration
    });

    const handlePlayTrack = (track: PlaylistTrack) => {
        playTrack(normalizeTrack(track));
    };

    const handlePlayAll = () => {
        if (!playlist?.tracks || playlist.tracks.length === 0) {
            toast.error('This playlist is empty');
            return;
        }
        playPlaylist(playlist.tracks.map(normalizeTrack));
    };

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    if (!playlist) {
        return <div className="text-center py-20">Playlist not found</div>;
    }

    const coverAlbumId = playlist.cover_album_id ?? playlist.tracks?.[0]?.album_id ?? null;
    const coverUrl = coverAlbumId ? api.getCoverUrl('album', coverAlbumId) : null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-8 md:flex-row items-end">
                <div className="h-64 w-64 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-primary/40 shadow-2xl flex items-center justify-center">
                    {coverUrl ? (
                        <img src={coverUrl} alt={playlist.name} className="h-full w-full object-cover" />
                    ) : (
                        <Music className="h-24 w-24 text-primary/40" />
                    )}
                </div>

                <div className="flex-1 space-y-4">
                    <h1 className="text-5xl font-bold tracking-tight">{playlist.name}</h1>
                    <p className="text-muted-foreground">
                        Playlist • {playlist.tracks?.length || 0} songs • Created {new Date(playlist.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-3">
                        <Button size="lg" className="rounded-full px-8" onClick={handlePlayAll}>
                            <Play className="mr-2 h-5 w-5" fill="currentColor" />
                            Play
                        </Button>
                        <Button
                            variant="destructive"
                            className="rounded-full"
                            onClick={() => {
                                if (confirm('Delete this playlist?')) {
                                    deletePlaylistMutation.mutate(playlist.id);
                                }
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Playlist
                        </Button>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm">
                <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 font-medium w-12">#</th>
                            <th className="px-4 py-3 font-medium">Title</th>
                            <th className="px-4 py-3 font-medium">Artist</th>
                            <th className="px-4 py-3 font-medium">Album</th>
                            <th className="px-4 py-3 font-medium text-right"><Clock className="ml-auto h-4 w-4" /></th>
                            <th className="px-4 py-3 font-medium w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {playlist.tracks?.map((track, i) => (
                            <tr
                                key={track.id}
                                className="group border-b border-muted/50 transition-colors hover:bg-muted/50 last:border-0"
                            >
                                <td className="px-4 py-3 text-muted-foreground">
                                    <span className="group-hover:hidden">{i + 1}</span>
                                    <button onClick={() => handlePlayTrack(track)} className="hidden group-hover:inline-block text-primary">
                                        <Play className="h-4 w-4" fill="currentColor" />
                                    </button>
                                </td>
                                <td className="px-4 py-3 font-medium">{track.title}</td>
                                <td className="px-4 py-3 text-muted-foreground">{track.artist}</td>
                                <td className="px-4 py-3 text-muted-foreground">{(track as any).album || 'Unknown Album'}</td>
                                <td className="px-4 py-3 text-right text-muted-foreground">
                                    {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                                </td>
                                <td className="px-4 py-3">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                        onClick={() => removeTrackMutation.mutate({ playlistId: playlist.id, trackId: track.id })}
                                        title="Remove from playlist"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {(!playlist.tracks || playlist.tracks.length === 0) && (
                            <tr>
                                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                                    This playlist is empty. Go to Library to add songs.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
