import express from 'express';
import { validateRequest, validators } from '../middleware/validate.js';

export const createSearchRouter = (searchController) => {
    const router = express.Router();

    router.get(
        '/',
        validateRequest({
            query: {
                q: validators.required
            }
        }),
        (req, res, next) => searchController.search(req, res, next)
    );

    return router;
};
