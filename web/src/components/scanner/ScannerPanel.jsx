import { Card } from '../ui/Card.jsx';

export function ScannerPanel({ scannerStatus, onRunScanner }) {
  const { isScanning, logs = [] } = scannerStatus || {};

  const buttonClasses = `
    py-3 px-6 rounded-lg font-semibold text-white
    bg-blue-600 hover:bg-blue-700
    disabled:bg-gray-400 disabled:cursor-not-allowed
    transition-colors
  `;

  return (
    <Card title="音乐库管理器">
      <div className="flex gap-4 items-center mb-5">
        <button onClick={onRunScanner} disabled={isScanning} className={buttonClasses}>
          {isScanning ? '扫描中...' : '扫描音乐库'}
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {isScanning ? '正在扫描和整理...' : '扫描器空闲'}
        </span>
      </div>

      <div className="scanner-logs">
        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">最近日志</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">暂无扫描记录</p>
        ) : (
          <ul className="text-sm text-gray-500 dark:text-gray-400 max-h-60 overflow-y-auto space-y-1 font-mono">
            {logs.slice(0, 20).map((log, index) => (
              <li key={`${log}-${index}`}>{log}</li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
