import db from './db.js';
console.log('DB initialized successfully');
console.log('Albums:', db.getAllAlbums().length);
