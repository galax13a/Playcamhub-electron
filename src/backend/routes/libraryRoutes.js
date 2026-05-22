'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/libraryController');
const { validate } = require('../middleware/validate');
const { ActivateSchema, MigrationStatusSchema, ImportSchema } = require('../schemas/library');

router.get('/export',           ctrl.exportLibrary);
router.post('/import',          validate(ImportSchema),               ctrl.importLibrary);
router.get('/migration-status', validate(MigrationStatusSchema, 'query'), ctrl.migrationStatus);
router.post('/activate',        validate(ActivateSchema),             ctrl.activateLicense);
router.post('/reset',           ctrl.resetLibrary);

module.exports = router;
