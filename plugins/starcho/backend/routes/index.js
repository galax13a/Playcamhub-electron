'use strict';

// Mount all starcho REST endpoints.
// Controller/model logic lives in src/backend/ — this file is the plugin's
// routing entry-point that re-uses those shared modules.

const router = require('express').Router();

router.use('/songs',      require('../../../../src/backend/routes/musicRoutes'));
router.use('/playlists',  require('../../../../src/backend/routes/playlistRoutes'));
router.use('/categories', require('../../../../src/backend/routes/categoryRoutes'));
router.use('/upload',     require('../../../../src/backend/routes/uploadRoutes'));
router.use('/library',    require('../../../../src/backend/routes/libraryRoutes'));
router.use('/download-queue', require('../../../../src/backend/routes/downloadRoutes'));

module.exports = router;
