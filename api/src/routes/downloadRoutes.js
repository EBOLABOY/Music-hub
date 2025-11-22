import express from 'express';
import { validateRequest, validators } from '../middleware/validate.js';

export const createDownloadRouter = (downloadController) => {
    const router = express.Router();

    router.get('/', (req, res) => downloadController.listTasks(req, res));
    router.get('/:id', (req, res) => downloadController.getTask(req, res));
    router.post(
        '/',
        validateRequest({
            body: {
                trackId: validators.required,
                source: validators.required
            }
        }),
        (req, res, next) => downloadController.createTask(req, res, next)
    );
    router.delete('/:id', (req, res) => downloadController.deleteTask(req, res));

    return router;
};
