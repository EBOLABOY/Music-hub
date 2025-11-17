import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';

import { api, type DownloadTask } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const isActiveTask = (task: DownloadTask) =>
  task.status !== 'completed' && task.status !== 'failed';

export function DownloadsPage() {
  const { data: tasks = [] } = useQuery<DownloadTask[]>({
    queryKey: ['tasks'],
    queryFn: api.getTasks,
    refetchInterval: 3000
  });

  const { activeTasks, completedCount, failedCount, historyTasks } = useMemo(() => {
    const active = tasks.filter(isActiveTask);
    const completed = tasks.filter((task) => task.status === 'completed');
    const failed = tasks.filter((task) => task.status === 'failed');
    const history = tasks
      .filter((task) => task.status === 'completed' || task.status === 'failed')
      .slice(0, 10);

    return {
      activeTasks: active,
      completedCount: completed.length,
      failedCount: failed.length,
      historyTasks: history
    };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full text-blue-600 dark:text-blue-300">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">进行中</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-50">
                {activeTasks.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full text-green-600 dark:text-green-300">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">已完成</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-50">{completedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full text-red-600 dark:text-red-300">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">失败</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-50">{failedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>下载队列</CardTitle>
          </CardHeader>
          <CardContent>
            {activeTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                当前没有正在进行的任务
              </div>
            ) : (
              <div className="space-y-4">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 border border-gray-100 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{task.title}</h4>
                        <p className="text-sm text-gray-500">{task.artist}</p>
                      </div>
                      <span className="text-xs font-mono px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {task.status}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.round((task.progress ?? 0) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{Math.round((task.progress ?? 0) * 100)}%</span>
                      <span>{task.bitrate || '加载中...'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近历史</CardTitle>
          </CardHeader>
          <CardContent>
            {historyTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">暂无历史记录</div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {historyTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 text-sm">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-700 dark:text-gray-300">
                        {task.title}
                      </p>
                      <p className="truncate text-xs text-gray-500">{task.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
