'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/uploadController');
const { validate } = require('../middleware/validate');
const { UploadSchema } = require('../schemas/upload');

router.post('/', validate(UploadSchema), ctrl.upload);

module.exports = router;
