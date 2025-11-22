import express from 'express';

export const createChartRouter = (chartController) => {
    const router = express.Router();

    router.get('/', (req, res, next) => chartController.getCharts(req, res, next));
    router.get('/:key', (req, res, next) => chartController.getChartByKey(req, res, next));

    return router;
};
