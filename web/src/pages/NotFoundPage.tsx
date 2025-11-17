import { useNavigate } from 'react-router-dom';
import { Ghost } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md border-none shadow-none bg-transparent">
        <CardContent className="flex flex-col items-center text-center space-y-6">
          <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-full">
            <Ghost className="w-12 h-12 text-gray-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">页面未找到</h1>
            <p className="text-gray-500 dark:text-gray-400">
              抱歉，你访问的页面不存在或已被移除。
            </p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              返回上一页
            </Button>
            <Button onClick={() => navigate('/')}>回到首页</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
