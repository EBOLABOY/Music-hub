const Panel = ({ icon, title, value, detail, accent }) => (
  <div className="rounded-2xl border border-white/40 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 backdrop-blur shadow-lg p-4 flex items-center gap-4 transition transform hover:-translate-y-0.5">
    <div
      className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-inner ${accent}`}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{detail}</p>
    </div>
  </div>
);

export function StatusOverview({ activeCount, resultsCount, scannerStatus }) {
  const latestLog = scannerStatus?.logs?.[0];
  const isScanning = Boolean(scannerStatus?.isScanning);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Panel
        title="活跃任务"
        value={activeCount}
        detail={activeCount > 0 ? '正在下载/转换中' : '下载队列空闲'}
        accent="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600"
        icon={
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12h18" strokeLinecap="round" />
            <path d="M7 15h10l-1 6H8l-1-6Z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        }
      />
      <Panel
        title="最近搜索结果"
        value={resultsCount}
        detail={resultsCount > 0 ? '找到的候选曲目' : '等待输入搜索'}
        accent="bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500"
        icon={
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="6" />
            <path d="M20 20 16.65 16.65" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />
      <Panel
        title="扫描器状态"
        value={isScanning ? '运行中' : '空闲'}
        detail={latestLog ? latestLog : '暂无日志'}
        accent="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500"
        icon={
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      />
    </div>
  );
}

