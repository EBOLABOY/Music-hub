export function TaskItem({ task }) {
  const progress = Math.round((task.progress || 0) * 100);

  return (
    <li className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div>
        <div>
          <strong className="font-medium text-gray-800 dark:text-gray-100">{task.title}</strong>
          <span className="text-sm text-gray-500 dark:text-gray-400"> {task.artist}</span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          状态：{task.status} | 进度：{progress}%
        </div>
      </div>

      {task.status === 'downloading' && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-2">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
    </li>
  );
}
