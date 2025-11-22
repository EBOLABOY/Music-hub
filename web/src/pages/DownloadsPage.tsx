import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, XCircle, Download, Clock, Music2, type LucideIcon } from 'lucide-react';
import { api, type DownloadTask } from '@/services/api';
import { cn } from '@/lib/utils';

const isActiveTask = (task: DownloadTask) => task.status !== 'completed' && task.status !== 'failed';

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
        <div className="relative min-h-[80vh] space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
                <div className="absolute top-20 right-0 w-96 h-96 bg-green-500/10 blur-[120px] animate-[pulse_10s_ease-in-out_infinite]" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 blur-[140px] animate-[pulse_14s_ease-in-out_infinite]" />
            </div>

            <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">Downloads</h1>
                <p className="text-muted-foreground">Monitor active tasks and download history.</p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <StatsCard
                    label="Active"
                    count={activeTasks.length}
                    icon={Activity}
                    color="text-blue-500"
                    bgColor="bg-blue-500/10"
                    borderColor="border-blue-500/20"
                />
                <StatsCard
                    label="Completed"
                    count={completedCount}
                    icon={CheckCircle2}
                    color="text-green-500"
                    bgColor="bg-green-500/10"
                    borderColor="border-green-500/20"
                />
                <StatsCard
                    label="Failed"
                    count={failedCount}
                    icon={XCircle}
                    color="text-red-500"
                    bgColor="bg-red-500/10"
                    borderColor="border-red-500/20"
                />
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Active Queue */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Download className="w-5 h-5 text-primary" />
                        Active Queue
                    </h2>

                    <div className="rounded-2xl border border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-md overflow-hidden shadow-sm">
                        {activeTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground/60">
                                <Download className="mb-4 h-12 w-12 opacity-20" />
                                <p className="font-medium">No active downloads</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {activeTasks.map((task) => {
                                    const progress = Math.round((task.progress ?? 0) * 100);
                                    return (
                                        <div
                                            key={task.id}
                                            className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center animate-in slide-in-from-left-4 hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
                                                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                    <Music2 className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium truncate">{task.title}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{task.artist}</div>
                                                </div>
                                            </div>

                                            <div className="w-full sm:w-1/2 flex flex-col gap-2">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-primary capitalize">{task.status}</span>
                                                    <span>{progress}%</span>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary transition-all duration-500 ease-out"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                {task.bitrate && (
                                                    <div className="text-[10px] text-right text-muted-foreground font-mono">{task.bitrate}</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* History */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        Recent History
                    </h2>

                    <div className="rounded-2xl border border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-md overflow-hidden shadow-sm">
                        {historyTasks.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground text-sm">No history available</div>
                        ) : (
                            <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                                {historyTasks.map((task) => (
                                    <div key={task.id} className="flex items-center gap-3 p-4 hover:bg-white/5 transition-colors group">
                                        {task.status === 'completed' ? (
                                            <div className="p-1.5 rounded-full bg-green-500/10 text-green-500 shrink-0">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                        ) : (
                                            <div className="p-1.5 rounded-full bg-red-500/10 text-red-500 shrink-0">
                                                <XCircle className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-foreground/90">{task.title}</p>
                                            <p className="truncate text-xs text-muted-foreground">{task.artist}</p>
                                        </div>
                                        <div className="text-xs font-medium">
                                            <span
                                                className={cn(
                                                    'px-2 py-0.5 rounded-full',
                                                    task.status === 'completed'
                                                        ? 'bg-green-500/5 text-green-600 dark:text-green-400'
                                                        : 'bg-red-500/5 text-red-600 dark:text-red-400'
                                                )}
                                            >
                                                {task.status === 'failed' ? 'Failed' : 'Done'}
                                            </span>
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

function StatsCard({
    label,
    count,
    icon: Icon,
    color,
    bgColor,
    borderColor
}: {
    label: string;
    count: number;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
}) {
    return (
        <div className={cn('relative overflow-hidden rounded-2xl border p-6 backdrop-blur-md transition-all hover:scale-[1.02]', bgColor, borderColor)}>
            <div className="flex items-center gap-4 relative z-10">
                <div className={cn('p-3 rounded-xl shadow-sm bg-white/60 dark:bg-black/20', color)}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground/80">{label}</p>
                    <p className="text-3xl font-bold tracking-tight">{count}</p>
                </div>
            </div>
            <Icon className={cn('absolute -right-6 -bottom-6 w-32 h-32 opacity-5 rotate-12 pointer-events-none', color)} />
        </div>
    );
}
