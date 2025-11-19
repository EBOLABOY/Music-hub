import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Check } from 'lucide-react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';

interface AddToPlaylistModalProps {
    trackId: string;
    onClose: () => void;
}

export function AddToPlaylistModal({ trackId, onClose }: AddToPlaylistModalProps) {
    const queryClient = useQueryClient();
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const { data: playlists, isLoading } = useQuery({
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
        onError: () => {
            toast.error('Failed to create playlist');
        }
    });

    const addToPlaylistMutation = useMutation({
        mutationFn: ({ playlistId, trackId }: { playlistId: string; trackId: string }) =>
            api.addTrackToPlaylist(playlistId, trackId),
        onSuccess: () => {
            toast.success('Added to playlist');
            onClose();
        },
        onError: (error: any) => {
            if (error.message.includes('Already exists')) {
                toast.error('Track already in playlist');
            } else {
                toast.error('Failed to add to playlist');
            }
        }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;
        createMutation.mutate(newPlaylistName);
    };

    const handleAddToPlaylist = (playlistId: string) => {
        addToPlaylistMutation.mutate({ playlistId, trackId });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
                    <h3 className="font-semibold">Add to Playlist</h3>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4">
                    {isCreating ? (
                        <form onSubmit={handleCreate} className="mb-4 flex gap-2">
                            <input
                                type="text"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                placeholder="Playlist Name"
                                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                            >
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                            >
                                Cancel
                            </button>
                        </form>
                    ) : (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                        >
                            <Plus className="h-4 w-4" />
                            New Playlist
                        </button>
                    )}

                    <div className="max-h-60 overflow-y-auto">
                        {isLoading ? (
                            <div className="py-4 text-center text-sm text-gray-500">Loading...</div>
                        ) : playlists?.length === 0 ? (
                            <div className="py-4 text-center text-sm text-gray-500">No playlists found</div>
                        ) : (
                            <div className="space-y-1">
                                {playlists?.map((playlist) => (
                                    <button
                                        key={playlist.id}
                                        onClick={() => handleAddToPlaylist(playlist.id)}
                                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                        <span className="truncate font-medium">{playlist.name}</span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(playlist.created_at).toLocaleDateString()}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
