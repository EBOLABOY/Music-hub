import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import config from './config.js';
import TaskStore from './taskStore.js';
import createRouter from './routes.js';
import DownloadManager from './downloadManager.js';
import LibraryService from './libraryService.js';
import streamRoutes from './streamRoutes.js';

const app = express();
const taskStore = new TaskStore();
const libraryService = new LibraryService(config);
const downloadManager = new DownloadManager({
  downloadDir: config.downloadDir,
  taskStore,
  cleanupMs: config.taskCleanupMs
});

app.use(cors());
app.use(express.json());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use('/api/media', streamRoutes);

app.use('/api', createRouter({ taskStore, downloadManager, libraryService, config }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticDir = process.env.STATIC_DIR || path.resolve(__dirname, '../../web/dist');
const staticIndex = path.join(staticDir, 'index.html');

if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    if (fs.existsSync(staticIndex)) {
      return res.sendFile(staticIndex);
    }
    return res.status(404).send('Not Found');
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server');
  server.close(() => process.exit(0));
});
