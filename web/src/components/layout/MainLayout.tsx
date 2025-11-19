import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { PlayerBar } from '@/components/PlayerBar';
import { usePlayer } from '@/contexts/PlayerContext';

export type ThemeMode = 'light' | 'dark';

interface MainLayoutProps {
  theme: ThemeMode;
  toggleTheme: () => void;
}

export function MainLayout({ theme, toggleTheme }: MainLayoutProps) {
  const { currentTrack, isPlaying } = usePlayer();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto scrollbar-hide pb-32">
          <div className="container mx-auto max-w-7xl p-6 md:p-10">
            <Outlet />
          </div>
        </main>

        {/* Floating Player Bar Effect */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="bg-white/80 backdrop-blur-2xl border-t border-white/20 shadow-2xl dark:bg-black/80 dark:border-white/10">
            <PlayerBar track={currentTrack} isPlaying={isPlaying} />
          </div>
        </div>
      </div>
    </div>
  );
}
