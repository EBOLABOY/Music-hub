import type { ComponentType, SVGProps } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Search, Download, Library, Moon, Sun, Music2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ThemeMode = 'light' | 'dark';

interface NavItem {
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}

interface MainLayoutProps {
  theme: ThemeMode;
  toggleTheme: () => void;
}

export function MainLayout({ theme, toggleTheme }: MainLayoutProps) {
  const location = useLocation();

  const navItems: NavItem[] = [
    { to: '/', icon: Search, label: '音乐搜索' },
    { to: '/downloads', icon: Download, label: '下载任务' },
    { to: '/library', icon: Library, label: '库管理' }
  ];

  const getPageTitle = () => {
    const current = navItems.find((item) => item.to === location.pathname);
    return current ? current.label : 'Music Hub';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex">
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform hidden md:flex md:flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
          <Music2 className="w-6 h-6 text-blue-600 mr-2" />
          <span className="text-xl font-bold tracking-tight">Music Hub</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">外观模式</span>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md bg-white dark:bg-gray-700 shadow-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 transition-all duration-200 ease-in-out">
        <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 px-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold md:hidden">{getPageTitle()}</h1>
          <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400">
            {getPageTitle()}
          </div>
          <div className="flex items-center gap-4" />
        </header>

        <div className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-around p-2 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-colors',
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
