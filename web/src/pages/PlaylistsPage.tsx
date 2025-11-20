import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ListMusic, Music } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export function PlaylistsPage() {
    const [isCreating, setIsCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const queryClient = useQueryClient();

    const { data: playlists = [] } = useQuery({
        queryKey: ['playlists'],
        queryFn: api.getPlaylists
    });

    const createMutation = useMutation({
        mutationFn: api.createPlaylist,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['playlists'] });
            setIsCreating(false);
            setNewPlaylistName('');
            toast.success('Playlist created');
        },
        onError: () => toast.error('Failed to create playlist')
    });

    const deleteMutation = useMutation({
        mutationFn: api.deletePlaylist,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['playlists'] });
            toast.success('Playlist deleted');
        },
        onError: () => toast.error('Failed to delete playlist')
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;
        createMutation.mutate(newPlaylistName);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Playlists</h1>
                    <p className="mt-2 text-muted-foreground">
                        Your personal collections
                    </p>
                </div>
                <Button onClick={() => setIsCreating(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Playlist
                </Button>
            </div>

            {isCreating && (
                <Card className="max-w-md animate-in fade-in slide-in-from-top-4">
                    <CardContent className="p-6">
                        <form onSubmit={handleCreate} className="flex gap-2">
                            <Input
                                autoFocus
                                placeholder="Playlist Name"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                            />
                            <Button type="submit" disabled={createMutation.isPending}>
                                Create
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>
                                Cancel
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {playlists.map((playlist) => {
                    const coverUrl = playlist.cover_album_id
                        ? api.getCoverUrl('album', playlist.cover_album_id)
                        : null;
                    return (
                        <div key={playlist.id} className="group relative">
                            <Link to={`/playlists/${playlist.id}`} className="block space-y-3">
                                <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-md transition-all duration-300 group-hover:shadow-xl dark:from-gray-800 dark:to-gray-900">
                                    {coverUrl ? (
                                        <img
                                            src={coverUrl}
                                            alt={playlist.name}
                                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <ListMusic className="h-16 w-16 text-muted-foreground/50" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-medium leading-none truncate">{playlist.name}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(playlist.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </Link>

                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (confirm('Delete this playlist?')) {
                                        deleteMutation.mutate(playlist.id);
                                    }
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    );
                })}
            </div>

            {playlists.length === 0 && !isCreating && (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                    <Music className="mb-4 h-16 w-16 opacity-20" />
                    <p className="text-lg">No playlists yet</p>
                    <Button variant="link" onClick={() => setIsCreating(true)}>
                        Create one now
                    </Button>
                </div>
            )}
        </div>
    );
}
