import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, XCircle, Download, Clock } from 'lucide-react';
import { api, type DownloadTask } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';

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
    // Sort history by newest first (assuming tasks are appended, so reverse)
    const history = [...tasks]
      .filter((task) => task.status === 'completed' || task.status === 'failed')
      .reverse()
      .slice(0, 50);

    return {
      activeTasks: active,
      completedCount: completed.length,
      failedCount: failed.length,
      historyTasks: history
    };
  }, [tasks]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Downloads</h1>
        <p className="text-muted-foreground">Manage your active downloads and history.</p>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-blue-500/10 border-blue-500/20 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-full text-blue-500">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{activeTasks.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-full text-green-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{completedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-full text-red-500">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold">{failedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Active Queue */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Download className="w-5 h-5" /> Active Queue
          </h2>

          <div className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden">
            {activeTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Download className="mb-4 h-10 w-10 opacity-20" />
                <p>No active downloads</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTasks.map((task) => (
                    <tr key={task.id} className="border-b border-muted/50 last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-muted-foreground">{task.artist}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500 ring-1 ring-inset ring-blue-500/20">
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-medium">{Math.round((task.progress ?? 0) * 100)}%</span>
                          <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-500"
                              style={{ width: `${Math.round((task.progress ?? 0) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{task.bitrate}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* History */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" /> Recent History
          </h2>

          <div className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden">
            {historyTasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No history available</div>
            ) : (
              <div className="divide-y divide-muted/50">
                {historyTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{task.artist}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {task.status === 'failed' ? 'Failed' : 'Done'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
