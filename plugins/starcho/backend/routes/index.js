'use strict';

// Mount all MediaHub (starcho) REST endpoints.
// Controller/model logic lives in src/backend/ — this file is the plugin's
// routing entry-point that re-uses those shared modules.

const router = require('express').Router();

router.use('/media',   require('../../../../src/backend/routes/mediaRoutes'));
router.use('/albums',  require('../../../../src/backend/routes/albumRoutes'));

module.exports = router;
