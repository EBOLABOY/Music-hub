import express from 'express';
import { ChartController } from './controllers/ChartController.js';
import { SearchController } from './controllers/SearchController.js';
import { DownloadController } from './controllers/DownloadController.js';
import { LibraryController } from './controllers/LibraryController.js';
import { createChartRouter } from './routes/chartRoutes.js';
import { createSearchRouter } from './routes/searchRoutes.js';
import { createDownloadRouter } from './routes/downloadRoutes.js';
import { createLibraryRouter } from './routes/libraryRoutes.js';

const createRouter = ({ taskStore, downloadManager, libraryService, config }) => {
  const router = express.Router();

  const chartController = new ChartController(config);
  const searchController = new SearchController();
  const downloadController = new DownloadController({ taskStore, downloadManager, config });
  const libraryController = new LibraryController(libraryService);

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  router.use('/charts', createChartRouter(chartController));
  router.use('/search', createSearchRouter(searchController));
  router.use('/downloads', createDownloadRouter(downloadController));
  router.use('/library', createLibraryRouter(libraryController));

  return router;
};

export default createRouter;
