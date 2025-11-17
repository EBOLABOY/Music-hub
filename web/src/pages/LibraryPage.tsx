import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDrive, RefreshCw, Terminal } from 'lucide-react';
import toast from 'react-hot-toast';

import { api, type ScannerStatus } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export function LibraryPage() {
  const queryClient = useQueryClient();

  const { data: status = { isScanning: false, logs: [] } } = useQuery<ScannerStatus>({
    queryKey: ['scannerStatus'],
    queryFn: api.getScannerStatus,
    refetchInterval: 3000
  });

  const { mutate: runScanner } = useMutation<{ success?: boolean }, Error>({
    mutationFn: api.runScanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scannerStatus'] });
      toast.success('扫描任务已提交');
    },
    onError: (err: Error) => toast.error(err.message || '启动扫描失败')
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>媒体库维护</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-sm">
              <HardDrive className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-1">全量扫描</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                扫描配置的音乐目录，导入新文件并整理元数据。这可能需要几分钟时间。
              </p>
            </div>
            <Button onClick={() => runScanner()} disabled={status.isScanning} size="lg">
              {status.isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  正在扫描...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  立即扫描
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            System Logs
          </CardTitle>
          <span className="text-xs text-gray-500">实时</span>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-950 text-gray-300 font-mono text-sm p-4 rounded-lg h-80 overflow-y-auto shadow-inner border border-gray-800">
            {status.logs && status.logs.length > 0 ? (
              <ul className="space-y-1">
                {status.logs.map((log, index) => (
                  <li
                    key={`${index}-${log.slice(0, 8)}`}
                    className="break-all border-l-2 border-gray-800 pl-2 hover:border-blue-500 transition-colors"
                  >
                    <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600">
                暂无活动日志...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
