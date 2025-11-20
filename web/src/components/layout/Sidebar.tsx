import { NavLink } from 'react-router-dom';
import { Home, Search, Library, ListMusic, Plus, Music2, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

export function Sidebar() {
    const { data: playlists = [] } = useQuery({
        queryKey: ['playlists'],
        queryFn: api.getPlaylists
    });

    const navItems = [
        { icon: Home, label: 'Home', href: '/' },
        { icon: Search, label: 'Search', href: '/search' },
        { icon: Library, label: 'Library', href: '/library' },
        { icon: Download, label: 'Downloads', href: '/downloads' },
    ];

    return (
        <div className="flex h-full w-[280px] flex-col bg-gray-50/50 backdrop-blur-xl border-r border-gray-200/50 dark:bg-black/50 dark:border-white/20">
            <div className="p-6">
                <div className="flex items-center gap-2 px-2 mb-8">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
                        <Music2 className="h-5 w-5" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">Music Hub</span>
                </div>

                <nav className="space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 border-l-4 border-transparent",
                                    isActive
                                        ? "border-primary bg-gray-200/50 text-primary dark:bg-white/10 dark:text-white"
                                        : "text-gray-500 hover:bg-gray-100/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                                )
                            }
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-2 scrollbar-hide">
                <div className="mb-2 flex items-center justify-between px-2">
                    <h3 className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
                        Playlists
                    </h3>
                    <button
                        onClick={() => {/* TODO: Trigger create playlist modal */ }}
                        className="text-gray-400 hover:text-primary transition-colors"
                        aria-label="New playlist"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-1">
                    <NavLink
                        to="/playlists"
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 border-l-4 border-transparent",
                                isActive
                                    ? "border-primary bg-gray-200/50 text-primary dark:bg-white/10 dark:text-white"
                                    : "text-gray-500 hover:bg-gray-100/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                            )
                        }
                    >
                        <ListMusic className="h-4 w-4" />
                        All Playlists
                    </NavLink>
                    {playlists.map((playlist) => (
                        <NavLink
                            key={playlist.id}
                            to={`/playlists/${playlist.id}`}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 border-l-4 border-transparent",
                                    isActive
                                        ? "border-primary bg-gray-200/50 text-primary dark:bg-white/10 dark:text-white"
                                        : "text-gray-500 hover:bg-gray-100/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                                )
                            }
                        >
                            <ListMusic className="h-4 w-4" />
                            <span className="truncate">{playlist.name}</span>
                        </NavLink>
                    ))}
                </div>
            </div>

            <div className="p-6 border-t border-gray-200/50 dark:border-white/20">
                <div className="flex items-center gap-3 rounded-xl bg-white/50 p-3 backdrop-blur-sm dark:bg-white/5">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/60" />
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">User</p>
                        <p className="truncate text-xs text-gray-500">Premium</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
