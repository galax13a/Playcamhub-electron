'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/downloadController');
const { validate } = require('../middleware/validate');
const { IdParamsSchema, DownloadAddSchema } = require('../schemas/download');

router.get('/',         ctrl.list);
router.post('/',        validate(DownloadAddSchema),             ctrl.add);
router.delete('/clear', ctrl.clearFinished);
router.delete('/:id',   validate(IdParamsSchema, 'params'),     ctrl.remove);

module.exports = router;
