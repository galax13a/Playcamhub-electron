'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/libraryController');

router.get('/export',           ctrl.exportLibrary);
router.post('/import',          ctrl.importLibrary);
router.get('/migration-status', ctrl.migrationStatus);
router.post('/activate',        ctrl.activateLicense);
router.post('/reset',           ctrl.resetLibrary);

module.exports = router;
