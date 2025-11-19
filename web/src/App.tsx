import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { MainLayout, type ThemeMode } from '@/components/layout/MainLayout';
import { HomePage } from '@/pages/HomePage';
import { DownloadsPage } from '@/pages/DownloadsPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SearchPage } from '@/pages/SearchPage';
import { PlaylistsPage } from '@/pages/PlaylistsPage';
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage';
import { PlayerProvider } from '@/contexts/PlayerContext';

const queryClient = new QueryClient();

function AppErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-2xl font-bold">应用出错了</h1>
        <p className="text-gray-600 dark:text-gray-300 break-all">{error.message}</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => resetErrorBoundary()}>
            重试
          </Button>
          <Button onClick={() => window.location.reload()}>刷新页面</Button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      return (window.localStorage.getItem('theme') as ThemeMode) || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary
        FallbackComponent={AppErrorFallback}
        onReset={() => window.location.reload()}
      >
        <PlayerProvider>
          <BrowserRouter>
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'dark:bg-gray-800 dark:text-white',
                style: { borderRadius: '10px' }
              }}
            />
            <Routes>
              <Route path="/" element={<MainLayout theme={theme} toggleTheme={toggleTheme} />}>
                <Route index element={<HomePage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="downloads" element={<DownloadsPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="playlists" element={<PlaylistsPage />} />
                <Route path="playlists/:id" element={<PlaylistDetailPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PlayerProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
