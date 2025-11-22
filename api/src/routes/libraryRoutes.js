import express from 'express';

export const createLibraryRouter = (libraryController) => {
    const router = express.Router();

    router.post('/scan', (req, res) => libraryController.scan(req, res));
    router.get('/status', (req, res) => libraryController.getStatus(req, res));

    return router;
};
