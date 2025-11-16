import { Card } from '../ui/Card.jsx';

export function SearchForm({ query, onQueryChange, onSubmit, searching, searchSource, onSourceChange }) {
  const buttonClasses = `
    py-3 px-6 rounded-lg font-semibold text-white
    bg-blue-600 hover:bg-blue-700
    disabled:bg-gray-400 disabled:cursor-not-allowed
    transition-colors
  `;

  const inputClasses = `
    flex-1 block w-full
    px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800
    text-gray-900 dark:text-gray-100
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
  `;

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex gap-3">
        <input
          type="text"
          placeholder="输入歌曲名..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className={inputClasses}
        />
        <button type="submit" disabled={searching} className={buttonClasses}>
          {searching ? '搜索中...' : '搜索'}
        </button>
      </form>

      <div className="mt-4 flex gap-4 text-gray-600 dark:text-gray-300">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="source"
            value="qobuz"
            checked={searchSource === 'qobuz'}
            onChange={(event) => onSourceChange(event.target.value)}
            className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
          />
          Qobuz
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="source"
            value="netease"
            checked={searchSource === 'netease'}
            onChange={(event) => onSourceChange(event.target.value)}
            className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
          />
          网易云音乐
        </label>
      </div>

    </Card>
  );
}
