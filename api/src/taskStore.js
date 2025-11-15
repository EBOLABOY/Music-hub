import { v4 as uuid } from 'uuid';

class TaskStore {
  constructor() {
    this.tasks = new Map();
  }

  createTask({ trackId, title, artist, source }) {
    const id = uuid();
    const now = new Date().toISOString();
    const task = {
      id,
      trackId,
      title,
      artist,
      source,
      status: 'queued',
      progress: 0,
      qbHash: null,
      filePath: null,
      downloadUrl: null,
      createdAt: now,
      updatedAt: now,
      lastKnownState: null
    };
    this.tasks.set(id, task);
    return task;
  }

  updateTask(id, updates) {
    if (!this.tasks.has(id)) return null;
    const existing = this.tasks.get(id);
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.tasks.set(id, updated);
    return updated;
  }

  attachHash(id, qbHash) {
    return this.updateTask(id, { qbHash });
  }

  attachDownloadUrl(id, downloadUrl) {
    return this.updateTask(id, { downloadUrl });
  }

  getTask(id) {
    return this.tasks.get(id) || null;
  }

  removeTask(id) {
    const task = this.tasks.get(id) || null;
    this.tasks.delete(id);
    return task;
  }

  listTasks() {
    return Array.from(this.tasks.values());
  }

  activeTasks() {
    return this.listTasks().filter((task) => task.status !== 'completed' && task.status !== 'failed');
  }
}

export default TaskStore;
