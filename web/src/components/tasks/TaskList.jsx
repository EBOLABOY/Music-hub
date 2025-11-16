import { Card } from '../ui/Card.jsx';
import { TaskItem } from './TaskItem.jsx';

export function TaskList({ tasks }) {
  return (
    <Card title="正在进行的任务">
      {tasks.length === 0 && <p className="py-8 text-center text-gray-500 dark:text-gray-400">暂无任务</p>}

      <ul className="mt-4 flex flex-col gap-3">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
    </Card>
  );
}
