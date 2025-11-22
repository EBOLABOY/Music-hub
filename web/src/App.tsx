import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { MainLayout, type ThemeMode } from '@/components/layout/MainLayout';
import { PlayerProvider } from '@/contexts/PlayerContext';

const HomePage = lazy(() => import('@/pages/HomePage').then(module => ({ default: module.HomePage })));
const DownloadsPage = lazy(() => import('@/pages/DownloadsPage').then(module => ({ default: module.DownloadsPage })));
const LibraryPage = lazy(() => import('@/pages/LibraryPage').then(module => ({ default: module.LibraryPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })));
const SearchPage = lazy(() => import('@/pages/SearchPage').then(module => ({ default: module.SearchPage })));
const PlaylistsPage = lazy(() => import('@/pages/PlaylistsPage').then(module => ({ default: module.PlaylistsPage })));
const PlaylistDetailPage = lazy(() => import('@/pages/PlaylistDetailPage').then(module => ({ default: module.PlaylistDetailPage })));
const ChartDetailPage = lazy(() => import('@/pages/ChartDetailPage').then(module => ({ default: module.ChartDetailPage })));

const PageLoader = () => (
  <div className="flex h-full w-full items-center justify-center min-h-[50vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

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
                <Route index element={
                  <Suspense fallback={<PageLoader />}>
                    <HomePage />
                  </Suspense>
                } />
                <Route path="search" element={
                  <Suspense fallback={<PageLoader />}>
                    <SearchPage />
                  </Suspense>
                } />
                <Route path="downloads" element={
                  <Suspense fallback={<PageLoader />}>
                    <DownloadsPage />
                  </Suspense>
                } />
                <Route path="library" element={
                  <Suspense fallback={<PageLoader />}>
                    <LibraryPage />
                  </Suspense>
                } />
                <Route path="playlists" element={
                  <Suspense fallback={<PageLoader />}>
                    <PlaylistsPage />
                  </Suspense>
                } />
                <Route path="playlists/:id" element={
                  <Suspense fallback={<PageLoader />}>
                    <PlaylistDetailPage />
                  </Suspense>
                } />
                <Route path="charts/:key" element={
                  <Suspense fallback={<PageLoader />}>
                    <ChartDetailPage />
                  </Suspense>
                } />
                <Route path="*" element={
                  <Suspense fallback={<PageLoader />}>
                    <NotFoundPage />
                  </Suspense>
                } />
              </Route>
            </Routes>
          </BrowserRouter>
        </PlayerProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
