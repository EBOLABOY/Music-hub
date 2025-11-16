export function Header({ theme, onToggleTheme }) {
  return (
    <header className="pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Music Hub</h1>
        <p className="text-base text-gray-600 dark:text-gray-400">搜索音乐并通过 NAS 下载（内置下载器）</p>
      </div>
      <button
        type="button"
        onClick={onToggleTheme}
        className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 hover:from-gray-100 hover:to-gray-200 dark:from-gray-700 dark:to-gray-800 dark:text-gray-100 dark:hover:from-gray-600 dark:hover:to-gray-700 shadow-sm"
      >
        <span className="text-xs uppercase tracking-wider">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        <span className="text-lg">{theme === 'dark' ? '🌞' : '🌙'}</span>
      </button>
    </header>
  );
}
