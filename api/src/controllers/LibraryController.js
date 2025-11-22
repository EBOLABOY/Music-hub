export class LibraryController {
    constructor(libraryService) {
        this.libraryService = libraryService;
    }

    scan(req, res) {
        if (!this.libraryService?.downloadDir) {
            return res.status(501).json({ error: 'DOWNLOAD_DIR is not configured on the server.' });
        }
        if (this.libraryService.isScanning) {
            return res.status(409).json({ message: 'A scan is already in progress.' });
        }
        res.status(202).json({ message: 'Library scan started.' });
        this.libraryService.runScan().catch((err) => {
            console.error('Unhandled library scanner error:', err);
        });
    }

    getStatus(req, res) {
        if (!this.libraryService) {
            return res.json({ isScanning: false, logs: [] });
        }
        res.json(this.libraryService.getStatus());
    }
}
