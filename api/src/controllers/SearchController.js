import { searchTracks } from '../musicSource.js';

export class SearchController {
    async search(req, res, next) {
        try {
            const rawQuery = (req.query.q || '').toString();
            const rawSource = (req.query.source || 'qobuz').toString();
            const trimmed = rawQuery.trim();
            if (!trimmed) {
                return res.status(400).json({ error: 'Missing query parameter `q`' });
            }
            const results = await searchTracks(rawQuery, rawSource);
            res.json({ query: trimmed, rawQuery, source: rawSource, results });
        } catch (error) {
            next(error);
        }
    }
}
