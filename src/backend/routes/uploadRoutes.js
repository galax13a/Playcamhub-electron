'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/uploadController');

router.post('/', ctrl.upload);

module.exports = router;
