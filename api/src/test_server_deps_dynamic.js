(async () => {
    try {
        console.log('Importing config...');
        await import('./config.js');
        console.log('config ok');

        console.log('Importing taskStore...');
        await import('./taskStore.js');
        console.log('TaskStore ok');

        console.log('Importing routes...');
        await import('./routes.js');
        console.log('createRouter ok');

        console.log('Importing downloadManager...');
        await import('./downloadManager.js');
        console.log('DownloadManager ok');

        console.log('Importing libraryService...');
        await import('./libraryService.js');
        console.log('LibraryService ok');

        console.log('Importing streamRoutes...');
        await import('./streamRoutes.js');
        console.log('streamRoutes ok');

        console.log('Importing errorHandler...');
        await import('./middleware/errorHandler.js');
        console.log('errorHandler ok');

        console.log('Importing playlistRoutes...');
        await import('./playlistRoutes.js');
        console.log('playlistRoutes ok');
    } catch (e) {
        console.error('ERROR:', e);
    }
})();
